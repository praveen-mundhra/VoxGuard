"""Calibrate model decision thresholds from labeled validation scores.

Input CSV columns:
    model,score,label

``label`` is 1 for the model's positive class and 0 for its negative class.
The positive class is genuine for speaker verification and spoof for deepfake
scores when using the backend's current score definitions.
"""

from __future__ import annotations

import argparse
import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class CalibrationResult:
    model: str
    threshold: float
    eer: float
    far: float
    frr: float
    positive_count: int
    negative_count: int
    higher_score_is_positive: bool


def _rates(
    scores: list[float], labels: list[int], threshold: float, higher_score_is_positive: bool
) -> tuple[float, float]:
    positives = sum(labels)
    negatives = len(labels) - positives
    predicted_positive = [
        score >= threshold if higher_score_is_positive else score <= threshold
        for score in scores
    ]
    false_accepts = sum(
        prediction and label == 0 for prediction, label in zip(predicted_positive, labels)
    )
    false_rejects = sum(
        not prediction and label == 1 for prediction, label in zip(predicted_positive, labels)
    )
    return (
        false_accepts / negatives if negatives else 0.0,
        false_rejects / positives if positives else 0.0,
    )


def calibrate_scores(
    model: str,
    scores: Iterable[float],
    labels: Iterable[int],
    *,
    higher_score_is_positive: bool = True,
) -> CalibrationResult:
    score_values = [float(score) for score in scores]
    label_values = [int(label) for label in labels]
    if len(score_values) != len(label_values):
        raise ValueError("scores and labels must contain the same number of values")
    if not score_values:
        raise ValueError("validation scores cannot be empty")
    if any(label not in (0, 1) for label in label_values):
        raise ValueError("labels must be binary 0/1")
    positive_count = sum(label_values)
    negative_count = len(label_values) - positive_count
    if not positive_count or not negative_count:
        raise ValueError("validation data must contain both positive and negative labels")

    unique_scores = sorted(set(score_values))
    if higher_score_is_positive:
        candidates = [unique_scores[0] - 1.0, *unique_scores, unique_scores[-1] + 1.0]
    else:
        candidates = [unique_scores[0] - 1.0, *unique_scores, unique_scores[-1] + 1.0]

    best = None
    for threshold in candidates:
        far, frr = _rates(score_values, label_values, threshold, higher_score_is_positive)
        key = (abs(far - frr), far + frr, threshold)
        if best is None or key < best[0]:
            best = (key, threshold, far, frr)

    _, threshold, far, frr = best
    return CalibrationResult(
        model=model,
        threshold=threshold,
        eer=(far + frr) / 2.0,
        far=far,
        frr=frr,
        positive_count=positive_count,
        negative_count=negative_count,
        higher_score_is_positive=higher_score_is_positive,
    )


def read_scores(path: Path) -> dict[str, list[tuple[float, int]]]:
    grouped: dict[str, list[tuple[float, int]]] = {}
    with path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        required = {"model", "score", "label"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("CSV must contain model, score, and label columns")
        for row in reader:
            model = row["model"].strip()
            grouped.setdefault(model, []).append((float(row["score"]), int(row["label"])))
    return grouped


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("validation_csv", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--direction",
        action="append",
        default=[],
        metavar="MODEL=high|low",
        help="Score direction per model; repeat for multiple models (default: high).",
    )
    args = parser.parse_args()
    directions = {}
    for value in args.direction:
        model, direction = value.split("=", 1)
        if direction not in {"high", "low"}:
            raise ValueError("direction must be high or low")
        directions[model] = direction == "high"

    results = {}
    for model, rows in read_scores(args.validation_csv).items():
        result = calibrate_scores(
            model,
            (score for score, _ in rows),
            (label for _, label in rows),
            higher_score_is_positive=directions.get(model, True),
        )
        results[model] = asdict(result)
    if not results:
        raise ValueError("validation CSV contains no rows")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
