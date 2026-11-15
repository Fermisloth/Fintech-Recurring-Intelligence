"""Independent development fixtures; frozen evaluation data is not used here."""

from importlib.util import find_spec
from itertools import product


def evidence(value):
    # An assertion gives a clear feature-missing red before the module exists.
    assert find_spec("src.merchant_identity") is not None, "Task 2A preprocessing module is missing"
    from src.merchant_identity import descriptor_evidence
    return descriptor_evidence(value)


def test_comparison_normalizes_without_mutating_observed_descriptor():
    raw = "  Ｐａｐｅｒ\tDesk / India--Autopay  "
    result = evidence(raw)
    assert result.raw_descriptor == raw
    assert result.comparison_text == "PAPER DESK INDIA AUTOPAY"
    assert result.rule_version == "task2a-v1"


def test_only_bounded_leading_channel_and_labelled_references_are_removed():
    result = evidence("UPI/Paper Desk RRN:123456789012 REF AB123456")
    assert result.comparison_text == "PAPER DESK"
    assert result.channels == ("UPI",)
    assert result.references == ("123456789012", "AB123456")
    assert evidence("Paper UPI Desk 123456789012").comparison_text == "PAPER UPI DESK 123456789012"
    assert evidence("UPILABS REFUND REF 1MG").comparison_text == "UPILABS REFUND REF 1MG"
    assert evidence("REF " + "1" * 36).references == ()
    assert evidence("PAPER REF ABCDEFG").references == ()
    assert evidence("REF 24Seven").comparison_text == "REF 24SEVEN"
    assert evidence("RRN 1MGPHARMACY").comparison_text == "RRN 1MGPHARMACY"


def test_meaningful_numeric_tokens_survive():
    assert evidence("UPI/1MG RRN 123456789012").comparison_text == "1MG"
    assert evidence("24Seven Store 2").comparison_text == "24SEVEN STORE 2"
    assert evidence("UPI/6247832910/SPOTIFY").comparison_text == "6247832910 SPOTIFY"


def test_vpas_are_evidence_never_inferred_merchant_names():
    result = evidence("UPI/Paper Desk/paper.desk@bank")
    assert result.vpas == ("PAPER.DESK@BANK",)
    assert result.comparison_text == "PAPER DESK"
    assert not result.ambiguous
    assert evidence("UPI/paper@bank").comparison_text == ""
    multiple = evidence("Paper Desk a@bank b@bank")
    assert multiple.vpas == ("A@BANK", "B@BANK")
    assert multiple.ambiguous


def test_malformed_vpas_are_not_partially_extracted():
    for token in ("a@@bank", "@bank", "a@", "a@bank.example", ".a@bank", "a..b@bank"):
        result = evidence("Paper Desk " + token)
        assert result.vpas == (), token
        assert result.ambiguous, token
    assert evidence("UPI RRN 123456789012").comparison_text == ""


def test_generated_normalization_is_idempotent_and_preserves_numeric_brands():
    for brand, separator, prefix in product(("1MG", "24Seven", "Paper Desk"), (" ", "/", "--", "\t"), ("", "UPI/")):
        raw = prefix + separator.join(brand.split()) + " RRN:123456789012"
        result = evidence(raw)
        assert result.raw_descriptor == raw
        assert result.comparison_text == brand.upper()
        assert evidence(result.comparison_text).comparison_text == result.comparison_text


def test_stacked_channels_are_ambiguous_and_comparison_remains_idempotent():
    for raw in ("UPI UPI Paper Desk", "UPI/IMPS/Paper Desk"):
        result = evidence(raw)
        assert result.ambiguous
        assert result.comparison_text == "PAPER DESK"
        assert evidence(result.comparison_text).comparison_text == result.comparison_text


def test_reference_separators_do_not_become_new_evidence_on_second_pass():
    for separator in ("/", "-", ":", "=", "#", " "):
        raw = "Paper Desk RRN" + separator + "123456"
        result = evidence(raw)
        assert result.comparison_text == "PAPER DESK"
        assert evidence(result.comparison_text).comparison_text == result.comparison_text


def test_oversized_descriptor_abstains_without_losing_raw_evidence():
    raw = "REF " + " " * 10000 + "1MG"
    result = evidence(raw)
    assert result.raw_descriptor == raw
    assert result.ambiguous
    assert result.comparison_text == ""
