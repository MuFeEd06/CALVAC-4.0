import math
from urllib.parse import urlparse
from api._lib._responses import ApiError

SHOES={'retro-court-hi','pulse-runner','cloud-knit','air-cushion-trainer','suede-chelsea','polished-brogue','heritage-derby'}


def sanitize_particle_settings(value):
    from api._lib._validation import clean_str
    fields={'eyebrow','headline','accent','body','desktop','mobile'}
    if not isinstance(value,dict) or set(value)-fields:
        raise ApiError(400,'Invalid particle hero settings')
    result={}
    for key in ('eyebrow','headline','accent','body'):
        if key in value:
            if not isinstance(value[key],str):raise ApiError(400,'Invalid hero text')
            result[key]=clean_str(value[key],600 if key=='body' else 200,multiline=key=='headline')
    for device in ('desktop','mobile'):
        if device not in value:continue
        view=value[device]
        if not isinstance(view,dict) or set(view)-{'shoe','image','darkImage','scale','x','y'}:
            raise ApiError(400,'Invalid hero device settings')
        safe={'shoe':view.get('shoe','retro-court-hi'),'image':'','darkImage':'','scale':1,'x':0,'y':0}
        if safe['shoe'] not in SHOES:raise ApiError(400,'Unknown hero shoe')
        for key in ('image','darkImage'):
            raw=view.get(key,'')
            if not isinstance(raw,str) or len(raw)>500:raise ApiError(400,'Invalid hero image URL')
            url=urlparse(raw)
            if raw and (url.scheme!='https' or url.hostname!='ik.imagekit.io' or url.username or url.password or url.fragment):
                raise ApiError(400,'Hero images must use an HTTPS ImageKit URL')
            safe[key]=raw
        for key in ('scale','x','y'):
            raw=view.get(key,safe[key]);minimum,maximum=(.5,1.5) if key=='scale' else (-25,25)
            if isinstance(raw,bool) or not isinstance(raw,(float,int)) or not math.isfinite(raw) or not minimum<=raw<=maximum:
                raise ApiError(400,'Invalid hero image position or scale')
            safe[key]=raw
        result[device]=safe
    return result
