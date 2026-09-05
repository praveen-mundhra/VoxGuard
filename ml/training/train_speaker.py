import argparse
p=argparse.ArgumentParser(); p.add_argument('--config',default='config.yaml'); a=p.parse_args(); print('ECAPA speaker training scaffold:',a)
