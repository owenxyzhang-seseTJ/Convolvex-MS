"""Preview and map user-selected CSV/TSV/Excel data without implicit resampling."""
import base64
import csv
import io
import math
import re
from pathlib import PurePath
from typing import Literal
from zipfile import ZipFile, BadZipFile
from pydantic import Field
from .massspec import Contract, MSDataset
from .nist import parse_jcamp
from .web_ms import dataset_summary
from .web_dems import DEMSDataset

MAX_BYTES = 20_000_000
UNITS = {"A":1., "mA":1e-3, "uA":1e-6, "µA":1e-6, "nA":1e-9, "pA":1e-12}


class ImportPayload(Contract):
    filename: str = Field(min_length=1,max_length=256)
    text: str | None = None
    content_base64: str | None = None
    sheet: str | None = None
    mode: Literal["auto","dems","series","spectrum","electrochemistry"] = "auto"
    time_column: int | None = Field(default=None,ge=-1,le=255)
    signal_columns: list[int] | None = None
    mz: list[float] | None = None
    time_unit: Literal["s","ms","min"] | None = None
    signal_unit: Literal["A","mA","uA","µA","nA","pA","a.u.","counts","Pa","mbar"] | None = None
    synthetic: bool = False
    current_column: int | None = Field(default=None,ge=-1,le=255)
    potential_column: int | None = Field(default=None,ge=-1,le=255)
    current_unit: Literal["A","mA","uA","µA","nA","pA","A/cm2","mA/cm2"] | None = None
    potential_unit: Literal["V","mV"] | None = None
    scan_rate_mV_s: float | None = Field(default=None,gt=0,allow_inf_nan=False)
    lsv_start_s: float = Field(default=0.,allow_inf_nan=False)
    electrode_area_cm2: float | None = Field(default=None,gt=0,allow_inf_nan=False)
    species_name: str | None = Field(default=None,min_length=1,max_length=96)


def mass_from_header(name):
    name = str(name).strip()
    match = re.match(r"^(?:m\s*/?\s*z|mass|m)\s*[_:= -]?\s*(\d+(?:\.\d+)?)", name, re.I)
    if match:
        return float(match.group(1))
    return float(name) if re.fullmatch(r"\d+(?:\.\d+)?",name) else None


def _number(value, row, column, *, missing=False):
    if value is None or str(value).strip() in {"","NA","N/A","NaN","nan"}:
        if missing:
            return 0.,False
        raise ValueError(f"第 {row} 行的 {column} 缺少数值")
    try:
        number = float(value)
    except (ValueError,TypeError):
        raise ValueError(f"第 {row} 行的 {column} 不是数值；不执行单元格公式") from None
    if not math.isfinite(number):
        raise ValueError(f"第 {row} 行的 {column} 包含非有限数值")
    return (number,True) if missing else number


def _read_table(payload):
    suffix = PurePath(payload.filename).suffix.lower()
    sheets = []
    if suffix == ".xlsx":
        try:
            raw = base64.b64decode(payload.content_base64 or "",validate=True)
        except ValueError:
            raise ValueError("Excel 文件编码无效") from None
        if len(raw)>MAX_BYTES:
            raise ValueError("导入文件超过 20 MB")
        from openpyxl import load_workbook
        try:
            with ZipFile(io.BytesIO(raw)) as archive:
                if sum(item.file_size for item in archive.infolist())>200_000_000:
                    raise ValueError("Excel 展开后超过当前大小限制")
            workbook = load_workbook(io.BytesIO(raw),read_only=True,data_only=False,keep_links=False)
            sheets = workbook.sheetnames
            name = payload.sheet or sheets[0]
            if payload.sheet is None:
                for candidate in sheets:
                    sample=[]
                    for row in workbook[candidate].iter_rows(values_only=True):
                        if any(value is not None for value in row): sample.append(row)
                        if len(sample)>=3: break
                    if len(sample)>=3 and sum(value is not None for value in sample[0])>=2:
                        name=candidate;break
                sheets=[name]+[item for item in sheets if item!=name]
            if name not in sheets:
                raise ValueError("指定工作表不存在")
            rows = []
            try:
                for row in workbook[name].iter_rows(values_only=True):
                    if len(rows)>200001 or len(row)>256:
                        raise ValueError("Excel 超过 200,000 行或 256 列")
                    if any(value is not None for value in row):
                        rows.append(list(row))
            finally:
                workbook.close()
        except (OSError,KeyError,TypeError,BadZipFile) as exc:
            raise ValueError("无法读取 Excel 工作表："+str(exc)) from None
    elif suffix in {".csv",".tsv",".txt"}:
        text = (payload.text or "").lstrip("\ufeff")
        if len(text.encode("utf-8"))>MAX_BYTES:
            raise ValueError("导入文件超过 20 MB")
        try:
            dialect = csv.Sniffer().sniff(text[:16384],delimiters=",;\t")
            rows = [row for row in csv.reader(io.StringIO(text),dialect) if any(cell.strip() for cell in row)]
        except csv.Error:
            rows = [re.split(r"\s+",line.strip()) for line in text.splitlines() if line.strip()]
    else:
        raise ValueError("表格导入支持 CSV、TSV、TXT 和 XLSX")
    if len(rows)<3:
        raise ValueError("需要列名和至少两行数据")
    headers = [str(value).strip() if value is not None else "" for value in rows[0]]
    while headers and not headers[-1] and all(len(row)<len(headers) or row[len(headers)-1] in {None,""} for row in rows[1:]):
        headers.pop()
    if not headers or len(headers)>256 or len(set(headers))!=len(headers) or any(not h for h in headers):
        raise ValueError("列名必须非空、唯一，且不超过 256 列")
    values = [row[:len(headers)] for row in rows[1:]]
    if len(values)*len(headers)>1_200_000 or any(len(row)!=len(headers) for row in values):
        raise ValueError("数据行的列数不一致，或超过当前大小限制")
    return headers,values,sheets


def _unit(header):
    match = re.search(r"(?:\(|\[|/|_)\s*(pA|nA|uA|µA|mA|A|Pa|mbar|counts|a\.u\.)\s*(?:\)|\])?$",header)
    return match.group(1) if match else "a.u."


def _ec_columns(payload, headers):
    current = payload.current_column
    potential = payload.potential_column
    if current is None:
        current = next((i for i,h in enumerate(headers) if re.match(r"^(?:current|i(?:[_/(\[ ]|$)|j(?:[_/(\[ ]|$)|电流)",h.replace('<','').replace('>',''),re.I)), -1)
    if potential is None:
        potential = next((i for i,h in enumerate(headers) if re.match(r"^(?:potential|voltage|ewe|e(?:[_/(\[ ]|$)|电位|电压)",h,re.I)), -1)
    if current >= len(headers) or potential >= len(headers) or current >= 0 and current == potential:
        raise ValueError("电流与电位需选择不同且有效的数据列")
    unit = _unit(headers[current]) if current>=0 else "A"
    if current>=0 and re.search(r"(?:mA|A)\s*[/·]?\s*cm(?:\^?[-−]?2|²)",headers[current]):
        unit = "mA/cm2" if "mA" in headers[current] else "A/cm2"
    return current,potential,payload.current_unit or (unit if unit in UNITS or unit in {"A/cm2","mA/cm2"} else "A"),payload.potential_unit or ("mV" if potential>=0 and "mV" in headers[potential] else "V")


def _ec_data(payload, headers, rows, time, time_column):
    current,potential,iu,eu = _ec_columns(payload,headers)
    if time_column>=0 and time_column in (current,potential):
        raise ValueError("时间列不能同时用作电位或电流列")
    optional = {}
    if current>=0:
        if iu in {"A/cm2","mA/cm2"} and payload.electrode_area_cm2 is None:
            raise ValueError("电流密度导入需要填写电极面积 / cm²，以换算原始电流")
        scale = UNITS[iu] if iu in UNITS else (1e-3 if iu=="mA/cm2" else 1.)*payload.electrode_area_cm2
        optional["current_A"]=[_number(row[current],i+2,headers[current])*scale for i,row in enumerate(rows)]
    if potential>=0:
        optional["potential_V"]=[_number(row[potential],i+2,headers[potential])*(.001 if eu=="mV" else 1.) for i,row in enumerate(rows)]
    if optional:
        optional["ec_time_s"]=time
    return optional


def _describe(payload,headers,rows,sheets):
    time_columns = [i for i,h in enumerate(headers) if re.match(r"^(?:time|t(?:[_/(\[ ]|$)|时间)",h,re.I)]
    mass_columns = [i for i,h in enumerate(headers) if mass_from_header(h) is not None]
    plain_mz = next((i for i,h in enumerate(headers) if h.lower().replace("/","") in {"mz","mass"}),None)
    intensity = next((i for i,h in enumerate(headers) if re.search(r"intensity|abundance|强度",h,re.I)),None)
    current,potential,iu,eu = _ec_columns(payload,headers)
    kind = "spectrum" if plain_mz is not None and intensity is not None and not time_columns else "dems" if mass_columns else "electrochemistry" if max(current,potential)>=0 else "series"
    time_column = payload.time_column if payload.time_column is not None else time_columns[0] if time_columns else -1 if kind=="electrochemistry" else 0
    if time_column>=len(headers):
        raise ValueError("时间列超出表格范围")
    time_header = headers[time_column].lower() if time_column>=0 else ""
    time_unit = payload.time_unit or ("ms" if re.search(r"(?:_|\(|\[|/)\s*ms",time_header) else "min" if "min" in time_header else "s")
    selected=mass_columns or [next((i for i in range(len(headers)) if i!=time_column),0)]
    detected_units={_unit(headers[i]) for i in selected}
    signal_unit=payload.signal_unit or (next(iter(detected_units)) if len(detected_units)==1 else "auto")
    return {"columns":headers,"rows":len(rows),"preview":[[str(v) if v is not None else "" for v in row] for row in rows[:6]],
        "sheets":sheets,"sheet":payload.sheet or (sheets[0] if sheets else None),"kind":kind,
        "time_column":time_column,"signal_columns":selected,
        "mz":[mass_from_header(headers[i]) for i in mass_columns],"time_unit":time_unit,
        "signal_unit":signal_unit,
        "current_column":current,"potential_column":potential,"current_unit":iu,"potential_unit":eu,
        "requires_scan_rate":time_column<0,"scan_rate_mV_s":payload.scan_rate_mV_s,
        "spectrum_mz_column":plain_mz,"spectrum_intensity_column":intensity}


def preview_import(payload):
    return _describe(payload,*_read_table(payload))


def import_table(payload):
    headers,rows,sheets = _read_table(payload)
    info = _describe(payload,headers,rows,sheets)
    mode = info["kind"] if payload.mode=="auto" else payload.mode
    if mode == "spectrum":
        xi,yi = info["spectrum_mz_column"],info["spectrum_intensity_column"]
        if xi is None or yi is None:
            raise ValueError("质谱表格需要 m/z 与 intensity 列")
        pairs = [(_number(row[xi],i+2,headers[xi]),_number(row[yi],i+2,headers[yi])) for i,row in enumerate(rows)]
        body = "\n".join(f"{x},{y}" for x,y in pairs)
        title=(payload.species_name or payload.filename).replace("\n"," ").replace("\r"," ")
        spectrum = parse_jcamp("##TITLE="+title+"\n##DATA TYPE=MASS SPECTRUM\n##PEAK TABLE=(XY..XY)\n"+body+"\n##END=",filename=payload.filename)
        spectrum["source"] = "local spectrum table"
        return {"kind":"spectrum","spectrum":spectrum}
    ti = info["time_column"]
    columns = payload.signal_columns if payload.signal_columns is not None else info["signal_columns"]
    factor = {"s":1.,"ms":.001,"min":60.}[info["time_unit"]]
    time_source="recorded time"
    if ti<0:
        if mode!="electrochemistry" or info['potential_column']<0 or payload.scan_rate_mV_s is None:
            raise ValueError("无时间列的 LSV 需要电位列、扫描速率 / mV·s⁻¹及起始时刻")
        potential=[_number(row[info['potential_column']],i+2,headers[info['potential_column']])*(.001 if info['potential_unit']=='mV' else 1.) for i,row in enumerate(rows)]
        delta=[right-left for left,right in zip(potential,potential[1:])]
        if any(v==0 for v in delta) or not (all(v>0 for v in delta) or all(v<0 for v in delta)):
            raise ValueError("无时间列时仅支持严格单向 LSV；往返或重复电位需要原始时间记录")
        time=[payload.lsv_start_s+abs(v-potential[0])/(payload.scan_rate_mV_s*.001) for v in potential]
        time_source="reconstructed from constant LSV scan rate"
    else:
        time = [_number(row[ti],i+2,headers[ti])*factor for i,row in enumerate(rows)]
    ec = _ec_data(payload,headers,rows,time,ti)
    if mode == "electrochemistry":
        if not ec:
            raise ValueError("请选择电位和／或电流列")
        DEMSDataset(time_s=time,mz=[1],signal=[[0.]*len(time)],signal_unit="A",time_origin="imported EC origin",**ec)
        return {"kind":"electrochemistry",**ec,"source_file":payload.filename,"synthetic":payload.synthetic,
                "time_source":time_source,"scan_rate_mV_s":payload.scan_rate_mV_s,"electrode_area_cm2":payload.electrode_area_cm2}
    if not columns or len(set(columns))!=len(columns) or any(i<0 or i>=len(headers) or i==ti for i in columns):
        raise ValueError("请选择不重复且不包含时间列的信号列")
    signal,valid,scales = [],[],[]
    input_units = [payload.signal_unit or _unit(headers[c]) for c in columns]
    output_units = ["A" if unit in UNITS else unit for unit in input_units]
    if len(set(output_units))!=1:
        raise ValueError("各信号列的物理单位不同，请分开导入或显式指定一致单位")
    for c,unit in zip(columns,input_units):
        values = [_number(row[c],i+2,headers[c],missing=True) for i,row in enumerate(rows)]
        scale = UNITS.get(unit,1.)
        signal.append([v*scale for v,_ in values]);valid.append([ok for _,ok in values])
        scales.append({"column":headers[c],"input_unit":unit,"output_unit":output_units[0],"factor":scale})
    metadata = {"name":payload.filename,"source_file":payload.filename,"time_input_unit":info["time_unit"],"column_units":scales}
    if mode == "series":
        if len(columns)!=1 or not all(valid[0]):
            raise ValueError("一维信号请选择一个完整数值列；多通道或缺测数据请使用 DEMS 模式")
        # Reuse the explicit MS time contract for validation, without storing
        # a fabricated mass number in the resulting generic project.
        data = MSDataset(time_s=time,mz=[1],signal=signal,signal_unit=output_units[0],time_origin="imported shared origin",metadata=metadata)
        if not dataset_summary(data)["uniform_time"]:
            raise ValueError("普通卷积需要均匀时间网格；原时间已保留，请使用显式非均匀算子")
        return {"kind":"series","project":{"schema_version":"1.0","task":"inverse","method":"fista",
            "operator":{"kind":"convolution","kernel":[1.],"input_shape":[len(time)],"mode":"causal","engine":"fft"},
            "observed":signal[0],"parameters":{"l2":.003,"max_iter":1500,"tol":1e-6,"nonnegative":True},
            "metadata":{**metadata,"axis":time,"synthetic":payload.synthetic,"kernel_identity":True}},
            "axis":time,"warning":"当前使用单位响应核；可在高级设置中导入实际仪器响应。"}
    masses = payload.mz if payload.mz is not None else [mass_from_header(headers[i]) for i in columns]
    if len(masses)!=len(columns) or any(m is None for m in masses):
        raise ValueError("请为每一个信号列填写对应的 m/z")
    optional = ec
    pressure = next((i for i,h in enumerate(headers) if h in {"pressure_Pa","pressure_mbar"}),None)
    if pressure is not None:
        optional.update(pressure=[_number(row[pressure],i+2,headers[pressure]) for i,row in enumerate(rows)],pressure_unit=headers[pressure].split("_")[-1])
    data = DEMSDataset(time_s=time,mz=masses,signal=signal,signal_unit=output_units[0],
        time_origin="imported shared origin; " + info["time_unit"] + " converted to s",valid=valid if not all(all(v) for v in valid) else None,
        metadata=metadata,synthetic=payload.synthetic,**optional)
    return {"kind":"dems","dataset":data.model_dump(),"summary":dataset_summary(data)}
