import argparse
p=argparse.ArgumentParser(); p.add_argument('--data',default='ml/datasets/metadata/scam.csv'); a=p.parse_args(); print('Scam classifier training scaffold:',a)
