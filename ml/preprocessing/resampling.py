import math, numpy as np
from scipy.signal import resample_poly
def to_16k_mono(audio,sample_rate):
    x=np.asarray(audio,dtype=np.float32); x=x.mean(axis=1) if x.ndim>1 else x
    if sample_rate==16000:return x
    g=math.gcd(int(sample_rate),16000); return resample_poly(x,16000//g,int(sample_rate)//g).astype(np.float32)
