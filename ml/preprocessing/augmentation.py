import numpy as np
def add_noise(x,snr_db=25):
    x=np.asarray(x,dtype=np.float32); p=np.mean(x*x)+1e-9; n=np.sqrt(p/(10**(snr_db/10)))*np.random.randn(len(x)); return np.clip(x+n,-1,1).astype(np.float32)
def gain(x,db): return np.clip(np.asarray(x)*10**(db/20),-1,1).astype(np.float32)
