from ml.evaluation.calibrate_thresholds import calibrate_scores


def test_calibrates_high_scores_as_positive():
    result = calibrate_scores("speaker", [0.9, 0.8, 0.2, 0.1], [1, 1, 0, 0])

    assert result.threshold == 0.8
    assert result.eer == 0.0
    assert result.far == 0.0
    assert result.frr == 0.0


def test_calibrates_low_scores_as_positive():
    result = calibrate_scores(
        "distance", [0.1, 0.2, 0.8, 0.9], [1, 1, 0, 0], higher_score_is_positive=False
    )

    assert result.threshold == 0.2
    assert result.eer == 0.0
    assert result.higher_score_is_positive is False
