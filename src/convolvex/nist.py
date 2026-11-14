"""On-demand public NIST WebBook EI spectra and local JCAMP-DX peak tables.

These are relative fragmentation references, not instrument calibrations.
Only the fixed official WebBook endpoint is fetched; no user-provided URL is used.
"""
from datetime import datetime, timezone
from functools import lru_cache
from html import unescape
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import numpy as np

WEBBOOK = "https://webbook.nist.gov/cgi/cbook.cgi"
ALIASES = {
    "co2": "124-38-9", "二氧化碳": "124-38-9", "carbon dioxide": "124-38-9",
    "co": "630-08-0", "一氧化碳": "630-08-0", "carbon monoxide": "630-08-0",
    "h2": "1333-74-0", "氢气": "1333-74-0", "hydrogen": "1333-74-0",
    "ch4": "74-82-8", "甲烷": "74-82-8", "methane": "74-82-8",
    "c2h4": "74-85-1", "乙烯": "74-85-1", "ethylene": "74-85-1",
    "c2h6": "74-84-0", "乙烷": "74-84-0", "ethane": "74-84-0",
    "h2o": "7732-18-5", "水": "7732-18-5", "water": "7732-18-5",
    "ethanol": "64-17-5", "乙醇": "64-17-5", "c2h5oh": "64-17-5",
    "o2": "7782-44-7", "氧气": "7782-44-7", "n2": "7727-37-9", "氮气": "7727-37-9",
}
NUMBER = r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?"

# Entries are search targets. Availability is determined from the actual
# WebBook response, never by shifting an unlabeled parent spectrum.
CATALOG = [
    ("co2rr","CO₂","二氧化碳","124-38-9"),("co2rr","CO","一氧化碳","630-08-0"),
    ("co2rr","H₂","氢气","1333-74-0"),("co2rr","CH₄","甲烷","74-82-8"),
    ("co2rr","C₂H₄","乙烯","74-85-1"),("co2rr","C₂H₆","乙烷","74-84-0"),
    ("co2rr","CH₃OH","甲醇","67-56-1"),("co2rr","C₂H₅OH","乙醇","64-17-5"),
    ("co2rr","HCOOH","甲酸（中性分子）","64-18-6"),("co2rr","CH₃COOH","乙酸（中性分子）","64-19-7"),
    ("co2rr","CH₃CHO","乙醛","75-07-0"),("co2rr","C₃H₇OH","1-丙醇","71-23-8"),
    ("norr","NO","一氧化氮","10102-43-9"),("norr","NO₂","二氧化氮","10102-44-0"),
    ("norr","N₂O","氧化亚氮","10024-97-2"),("norr","N₂","氮气","7727-37-9"),
    ("norr","NH₃","氨","7664-41-7"),("norr","NH₂OH","羟胺","7803-49-8"),
    ("norr","N₂H₄","肼","302-01-2"),
    ("cn_coupling","CH₄N₂O","尿素","57-13-6"),
    ("cn_coupling","CH₃NO","甲酰胺","75-12-7"),
    ("cn_coupling","C₂H₅NO","乙酰胺","60-35-5"),
    ("cn_coupling","CH₃NH₂","甲胺","74-89-5"),
    ("cn_coupling","C₂H₅NH₂","乙胺","75-04-7"),
    ("cn_coupling","(CH₃)₂NH","二甲胺","124-40-3"),
    ("cn_coupling","(CH₃)₃N","三甲胺","75-50-3"),
    ("cn_coupling","CH₃CN","乙腈","75-05-8"),
    ("cn_coupling","C₂H₅NO₂","甘氨酸","56-40-6"),
    ("cn_coupling","C₂H₇NO","乙醇胺","141-43-5"),
    ("cn_coupling","C₂H₄N₂O₂","草酰胺","471-46-5"),
    ("isotopes","¹³CO₂","碳-13 二氧化碳","1111-72-4"),
    ("isotopes","¹³CO","碳-13 一氧化碳","1641-69-6"),
    ("isotopes","¹³CH₄","碳-13 甲烷","methane-13C"),
    ("isotopes","¹⁵N₂","氮-15 氮气","2985-83-1"),
    ("isotopes","¹⁵NO","氮-15 一氧化氮","nitric oxide-15N"),
    ("isotopes","¹⁵NH₃","氮-15 氨","13767-16-3"),
    ("isotopes","D₂","氘气","7782-39-0"),("isotopes","D₂O","重水","7789-20-0"),
    ("isotopes","HDO","半重水","14940-63-7"),
    ("isotopes","¹⁸O₂","氧-18 氧气","oxygen-18O2"),
    ("isotopes","H₂¹⁸O","氧-18 水","14314-42-2"),
    ("common","H₂O","水","7732-18-5"),("common","O₂","氧气","7782-44-7"),
    ("common","Ar","氩气","7440-37-1"),("common","He","氦气","7440-59-7"),
    ("common","SO₂","二氧化硫","7446-09-5"),("common","H₂S","硫化氢","7783-06-4"),
    ("common","C₃H₆O","丙酮","67-64-1"),
]
ALIASES.update({name.split("（")[0].casefold():query for _,_,name,query in CATALOG})


def enrich_spectrum(spectrum):
    value=dict(spectrum)
    entry=next(((formula,name) for _,formula,name,query in CATALOG if query==value.get('cas')),None)
    value['display_name']=value.get('display_name') or (f"{entry[1].split('（')[0]} ({entry[0]})" if entry else value.get('name',''))
    return value


def spectrum_catalog():
    return {"groups":[{"id":"co2rr","label":"CO₂RR"},{"id":"norr","label":"NORR"},
                      {"id":"cn_coupling","label":"碳氮耦合"},
                      {"id":"isotopes","label":"同位素示踪"},{"id":"common","label":"常见催化"}],
            "entries":[{"group":group,"formula":formula,"name":name,"query":query,"availability":"on-demand",
                        "note":"低挥发或高极性产物的 EI 谱用于参考；常规 DEMS 可检测性需单独确认，衍生化谱请独立导入。" if query in {"57-13-6","56-40-6","471-46-5","141-43-5"} else ""}
                       for group,formula,name,query in CATALOG]}


def parse_jcamp(text, *, filename=None):
    if len(text) > 2_000_000:
        raise ValueError("JCAMP 图谱超过 2 MB")
    headers, peak_lines, key, in_peaks = {}, [], None, False
    for raw in text.replace("\r", "").split("\n"):
        line = raw.split("$$", 1)[0].strip()
        if not line:
            continue
        if line.startswith("##") and "=" in line:
            key, value = line[2:].split("=", 1)
            key = re.sub(r"\s+", " ", key.strip().upper())
            headers[key] = value.strip()
            in_peaks = key in {"PEAK TABLE", "PEAKTABLE", "XYPOINTS"}
            if in_peaks and value.strip().upper() not in {"(XY..XY)", "(XY..XY)".lower()}:
                raise ValueError("当前只支持 JCAMP 质谱的显式 (XY..XY) 峰表")
        elif in_peaks:
            peak_lines.append(line)
        elif key and not line.startswith("##"):
            headers[key] += "\n" + line
    if "MASS" not in headers.get("DATA TYPE", "").upper():
        raise ValueError("文件不是 JCAMP-DX 质谱；请提供 MASS SPECTRUM 峰表")
    peak_text = " ".join(peak_lines)
    if re.sub(NUMBER, "", peak_text).strip(" ,;\t"):
        raise ValueError("质谱峰表含无法识别的内容；需要显式数值峰对")
    values = re.findall(NUMBER, peak_text)
    if len(values) < 2 or len(values) % 2 or len(values) > 100_000:
        raise ValueError("质谱峰表必须包含有界的 m/z、强度数值对")
    peaks = np.asarray(list(map(float, values))).reshape(-1, 2)
    peaks[:, 0] *= float(headers.get("XFACTOR", 1))
    peaks[:, 1] *= float(headers.get("YFACTOR", 1))
    if not np.all(np.isfinite(peaks)) or np.any(peaks[:, 0] <= 0) or np.any(peaks[:, 1] < 0) or peaks[:, 1].max() <= 0:
        raise ValueError("图谱需要正的 m/z 和非负、有限且不全为零的峰强度")
    if len(np.unique(peaks[:, 0])) != len(peaks):
        raise ValueError("峰表包含重复 m/z；请先确认重复峰的处理方式")
    declared = headers.get("NPOINTS")
    if declared and int(declared) != len(peaks):
        raise ValueError("实际峰数与 JCAMP NPOINTS 不一致")
    peaks = peaks[np.argsort(peaks[:, 0])]
    return enrich_spectrum({
        "name": headers.get("TITLE", filename or "Imported mass spectrum")[:256],
        "cas": headers.get("CAS REGISTRY NO", ""),
        "formula": headers.get("MOLFORM", ""),
        "mz": peaks[:, 0].tolist(),
        "intensity": (100 * peaks[:, 1] / peaks[:, 1].max()).tolist(),
        "intensity_unit": "% of base peak", "spectrum_type": "mass spectrum",
        "owner": headers.get("OWNER", ""),
        "source": "local JCAMP-DX", "source_url": None,
        "record_id": headers.get("$NIST MASS SPEC NO", ""),
        "filename": filename,
    })


def _fetch(parameters):
    url = WEBBOOK + "?" + urlencode(parameters)
    try:
        request = Request(url, headers={"User-Agent": "Convolvex-MS/1.1 (public EI reference lookup)"})
        with urlopen(request, timeout=15) as response:
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError("NIST 返回内容过大")
        return raw.decode("utf-8", "replace"), url
    except HTTPError as exc:
        if exc.code == 404:
            raise LookupError("NIST WebBook 没有该物质的公开 EI 图谱") from None
        raise ConnectionError("NIST WebBook 暂时无法访问，请稍后重试") from None
    except (URLError, TimeoutError, OSError):
        raise ConnectionError("连接 NIST WebBook 超时；也可导入本地 JCAMP 图谱") from None


@lru_cache(maxsize=64)
def lookup_spectrum(query):
    query = query.strip()
    if not query or len(query) > 120:
        raise ValueError("请输入不超过 120 字符的物质名、分子式或 CAS 号")
    resolved = ALIASES.get(query.casefold(), query)
    if re.fullmatch(r"\d{2,7}-\d{2}-\d", resolved):
        compound_id = "C" + resolved.replace("-", "")
    elif re.fullmatch(r"C\d{3,12}", resolved):
        compound_id = resolved
    else:
        page, _ = _fetch({"Name": resolved, "Units": "SI", "Mask": "200"})
        # A single-entry page declares its own CAS number. Do not pick an
        # arbitrary isomer or the first related-species link from a result page.
        cas = re.search(r"CAS Registry Number:</strong>\s*([\d-]+)", page)
        if not cas:
            choices = []
            for identifier, name in re.findall(r'href="/cgi/cbook\.cgi\?ID=(C\d+)[^"]*"[^>]*>(.*?)</a>', page, re.S):
                name = unescape(re.sub(r"<[^>]+>", "", name)).strip()
                if name and identifier not in {item["id"] for item in choices}:
                    choices.append({"id": identifier, "name": name[:180]})
            if choices:
                return {"choices": choices[:30], "query": query}
            raise LookupError("没有找到唯一物质；请尝试英文名称或 CAS 号")
        compound_id = "C" + cas.group(1).replace("-", "")
    text, download_url = _fetch({"JCAMP": compound_id, "Index": "0", "Type": "Mass"})
    if not text.lstrip().startswith("##"):
        raise LookupError("该物质没有可公开下载的 NIST WebBook EI 图谱")
    spectrum = parse_jcamp(text)
    spectrum.update({
        "source": "NIST Chemistry WebBook, SRD 69", "spectrum_type":"EI mass spectrum", "compound_id": compound_id,
        "source_url": WEBBOOK + "?" + urlencode({"ID": compound_id, "Units": "SI", "Mask": "200"}) + "#Mass-Spec",
        "download_url": download_url, "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "usage": "Relative EI fragmentation reference; not an instrument sensitivity calibration or a confirmed identification.",
    })
    return spectrum
