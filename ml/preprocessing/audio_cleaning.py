from pathlib import Path
import soundfile as sf
SUPPORTED={'.wav','.flac','.ogg'}
def inspect(path):
    i=sf.info(path); return {'path':str(path),'samplerate':i.samplerate,'channels':i.channels,'duration':i.duration}
def scan(root): return [inspect(p) for p in map(str,Path(root).rglob('*')) if Path(p).suffix.lower() in SUPPORTED]
