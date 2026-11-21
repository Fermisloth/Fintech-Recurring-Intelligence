from datetime import date

import pytest

from src.detect_recurring_v3 import calendar_cadence, detect


@pytest.mark.parametrize("days,cadence,anchor,slot", [
    (("2025-02-26", "2025-03-31", "2025-04-30", "2025-05-31"), "monthly", 31, "2025-05-31"),
    (("2025-03-02", "2025-03-31", "2025-04-30", "2025-05-31"), "monthly", 31, "2025-05-31"),
    (("2024-02-27", "2024-03-31", "2024-04-30", "2024-05-31"), "monthly", 31, "2024-05-31"),
    (("2025-01-14", "2025-02-17", "2025-04-15", "2025-05-15"), "monthly", 15, "2025-05-15"),
    (("2024-03-02", "2024-05-31", "2024-08-31", "2024-11-30"), "quarterly", 31, "2024-11-30"),
    (("2022-03-02", "2023-02-28", "2024-02-29"), "annual", 29, "2024-02-29"),
])
def test_calendar_anchor_candidates_include_clamping_and_adjacent_months(days, cadence, anchor, slot):
    result = calendar_cadence([date.fromisoformat(day) for day in days], cadence)
    assert result[0] == cadence
    assert result[2] == anchor
    assert result[3] == date.fromisoformat(slot)


def test_calendar_insufficient_and_duplicate_evidence_abstains():
    for days in ([], ["2025-01-15"], ["2025-01-15", "2025-02-15"], ["2025-01-15"] * 3):
        assert calendar_cadence([date.fromisoformat(day) for day in days])[0] is None


def test_weekly_habitual_series_is_review_evidence_not_high_confidence_billing():
    from datetime import timedelta
    rows = [{"transaction_id": str(index), "date": date(2025, 1, 1) + timedelta(days=7 * index),
             "description": "Weekly shop", "amount": 100, "payment_method": "card"}
            for index in range(12)]
    candidates, predictions = detect(rows, {})
    assert candidates[0]["detected_cadence"] == "irregular"
    assert candidates[0]["heuristic_confidence"] <= 0.5
    assert all(row["review_required"] for row in predictions.values())
    assert "habitual" in candidates[0]["evidence"].lower()


def test_recovered_anchor_reaches_api_without_changing_commitment_hash():
    from src.api import analyze_statement
    from src.detect_recurring_v3 import detect as detect_rows
    days = ("2025-03-02", "2025-03-31", "2025-04-30", "2025-05-31")
    payload = {"analysis_id": "3f209041-37c8-4e10-bff9-c02a541d23b1",
               "csv": "date,description,amount\n" + "".join(f"{day},Calendar desk,-100\n" for day in days),
               "mapping": {"date": 0, "description": 1, "amount": 2}}
    result = analyze_statement(payload)
    commitment, = result["commitments"]
    assert commitment["billing_anchor_day"] == 31
    assert commitment["billing_anchor_date"] == "2025-05-31"
    assert len(commitment["transaction_ids"]) == 4
    rows = [{"transaction_id": f"statement-{index + 2}", "date": date.fromisoformat(day),
             "description": "Calendar desk", "amount": 100, "payment_method": ""}
            for index, day in enumerate(days)]
    baseline, _ = detect_rows(rows, {}, namespace="private-" + payload["analysis_id"], calendar=False)
    assert commitment["commitment_id"] == baseline[0]["commitment_id"]


def test_irregular_dates_do_not_gain_a_fitted_calendar_anchor():
    days = [date.fromisoformat(day) for day in ("2025-01-03", "2025-02-19", "2025-03-08", "2025-05-25")]
    assert calendar_cadence(days)[0] is None
