# Threshold calibration

`calibrate_thresholds.py` selects each model's operating threshold at the equal-error point from labeled validation scores. It does not create validation data or tune against the production stream.

Create a CSV with one row per validation example:

```csv
model,score,label
speaker,0.91,1
speaker,0.22,0
deepfake,0.87,1
deepfake,0.14,0
```

`label=1` is the model's positive class. For VoxGuard, that is genuine for speaker similarity and spoof for the AASIST spoof probability. Run calibration with the real held-out validation set:

```bash
python ml/evaluation/calibrate_thresholds.py validation_scores.csv --output VoxGuard-backened/model/thresholds.json --direction speaker=high --direction deepfake=high
```

The JSON artifact records the threshold, EER, FAR, FRR, and class counts for every model. Review those metrics before deploying the artifact. Keep the validation set separate from training data and include the codecs, noise conditions, languages, and synthesis systems expected in production.
