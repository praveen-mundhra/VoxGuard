from pathlib import Path
import csv
def build(root,output):
    root=Path(root); rows=[]
    for label in ('real','fake'):
        rows += [{'path':str(p),'label':label} for p in (root/label).rglob('*.wav')]
    with open(output,'w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=['path','label']); w.writeheader(); w.writerows(rows)
    return len(rows)
