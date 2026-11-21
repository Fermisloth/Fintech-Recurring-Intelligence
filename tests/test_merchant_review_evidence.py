from src.merchant_review import merchant_suggestions


def suggestions(*names):
    return merchant_suggestions({name.upper(): name for name in names}, {}, [], {})


def test_reference_and_vpa_variants_propose_review_without_identifier_leakage():
    result = suggestions("UPI/Paper Desk RRN:123456789012 paper@bank", "Paper Desk RRN:987654321012")
    assert len(result) == 1
    assert "recognized payment metadata" in result[0]["reason"]
    assert "123456" not in result[0]["reason"]
    assert "@" not in result[0]["reason"]


def test_generic_provider_addresses_ambiguity_and_numeric_collisions_abstain():
    for pair in (
        ("UPI/a@bank", "UPI/b@bank"),
        ("UPI/PAYTM RRN:123456789012", "PAYTM RRN:987654321012"),
        ("Paper Desk a@bank b@bank", "Paper Desk"),
        ("Paper Desk a@@bank", "Paper Desk"),
        ("1MG RRN:123456789012", "2MG RRN:987654321012"),
        ("24Seven", "Seven"),
        ("UPI/123456789012/Paper Desk", "Paper Desk"),
        ("Red Shop shared@bank", "Blue Shop shared@bank"),
    ):
        assert suggestions(*pair) == [], pair


def test_numeric_brand_and_separator_boundaries_are_preserved():
    assert len(suggestions("UPI/1MG RRN:123456789012", "1MG RRN:987654321012")) == 1
    assert suggestions("AB CAFE", "A BCAFE") == []


def test_generated_suggestions_are_bounded_and_input_order_independent():
    names = [f"UPI/Paper Desk RRN:{index:012d}" for index in range(80)]
    forward = suggestions(*names)
    assert len(forward) == 24
    assert forward == suggestions(*reversed(names))


def test_suggestions_do_not_change_detection_or_commitment_identity():
    from src.api import analyze_statement
    payload = {
        "analysis_id": "3f209041-37c8-4e10-bff9-c02a541d23b1",
        "csv": "date,description,amount\n" + "".join(
            f"2025-{month:02d}-15,{descriptor},-100\n"
            for month, descriptor in enumerate(("Paper Desk RRN:123456789012",) * 3 + ("Paper Desk RRN:987654321012",) * 3, 1)
        ),
        "mapping": {"date": 0, "description": 1, "amount": 2},
    }
    initial = analyze_statement(payload)
    assert len(initial["merchant_suggestions"]) == 1
    assert len(initial["commitments"]) == 2
    assert all(item["merchant_id"] is None for item in initial["commitments"])
    pair = [initial["merchant_suggestions"][0][key] for key in ("source", "target")]
    dismissed = analyze_statement({**payload, "merchant_dismissals": [pair]})
    assert dismissed["commitments"] == initial["commitments"]
    linked = analyze_statement({**payload, "aliases": [pair]})
    assert len(linked["commitments"]) == 1
    assert linked["commitments"][0]["transaction_count"] == 6
    assert analyze_statement(payload)["commitments"] == initial["commitments"]
    assert [row["description"] for row in linked["transactions"]] == [row["description"] for row in initial["transactions"]]


def test_trusted_exact_aliases_do_not_authorize_stripped_or_private_variants(monkeypatch):
    from datetime import date
    from src import api
    from src.detect_recurring_v3 import detect
    aliases = {"DESK SERVICES": "PAPER DESK"}
    descriptions = ["Paper Desk"] * 3 + ["Desk Services"] * 3 + ["UPI/Desk Services RRN:123456789012"] * 3
    rows = [{"transaction_id": str(month), "date": date(2025, month, 15), "description": description,
             "amount": 100, "payment_method": "UPI"}
            for month, description in enumerate(descriptions, 1)]
    candidates, predictions = detect(rows, aliases)
    assert sorted(item["transaction_count"] for item in candidates) == [3, 6]
    assert predictions["1"]["candidate_id"] == predictions["4"]["candidate_id"]
    assert predictions["7"]["candidate_id"] != predictions["4"]["candidate_id"]
    monkeypatch.setattr(api, "load_aliases", lambda: aliases)
    payload = {"csv": "date,description,amount\n" + "".join(
        f"{row['date']},{row['description']},-100\n" for row in rows),
        "mapping": {"date": 0, "description": 1, "amount": 2}}
    private = api.analyze_statement(payload)
    assert len(private["commitments"]) == 3  # Configuration suggests; it does not silently authorize private grouping.
    linked = api.analyze_statement({**payload, "aliases": [["Desk Services", "Paper Desk"]]})
    assert sorted(item["transaction_count"] for item in linked["commitments"]) == [3, 6]
