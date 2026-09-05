import time
def timed(fn,*args,**kwargs):
 t=time.perf_counter(); out=fn(*args,**kwargs); return out,time.perf_counter()-t
