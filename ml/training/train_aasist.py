import argparse
p=argparse.ArgumentParser(); p.add_argument('--config',default='config.yaml'); p.add_argument('--epochs',type=int,default=20); a=p.parse_args(); print('AASIST training scaffold:',a)
