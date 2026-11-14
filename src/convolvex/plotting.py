"""Project plotting defaults: Arial, editable vectors, explicit font provenance.

No font is distributed. A missing Arial installation is an error unless the
caller explicitly permits the metrically-compatible Arimo fallback.
"""
from pathlib import Path
import json

def configure(allow_fallback=False):
    import matplotlib as mpl
    from matplotlib import font_manager as fm
    requested='Arial'
    try:
        path=fm.findfont(fm.FontProperties(family=requested),fallback_to_default=False)
        actual=fm.FontProperties(fname=path).get_name()
        if actual.lower()!='arial': raise ValueError('Resolved font is not Arial')
    except ValueError:
        if not allow_fallback:
            raise RuntimeError('Arial is not installed. Install your licensed local font, or explicitly permit Arimo with --allow-font-fallback.') from None
        path=fm.findfont(fm.FontProperties(family='Arimo'),fallback_to_default=False)
        actual=fm.FontProperties(fname=path).get_name()
    mpl.rcParams.update({'font.family':actual,'font.size':10,'axes.labelsize':11,
                         'legend.fontsize':9,'axes.titlesize':11,'pdf.fonttype':42,
                         'ps.fonttype':42,'svg.fonttype':'none','axes.spines.top':False,
                         'axes.spines.right':False,'savefig.dpi':240})
    return {'requested':'Arial','rendered_font':actual,'exact_match':actual.lower()=='arial',
            'fallback_explicitly_permitted':allow_fallback,
            'font_files_distributed':False,'svg_text':'editable; rebuild with Arial to obtain exact font'}

def save(figure,path):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    for extension in ('pdf','svg','png'):
        figure.savefig(path.with_suffix('.'+extension),bbox_inches='tight')
