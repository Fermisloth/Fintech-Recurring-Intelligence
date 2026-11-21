"""Pure, review-only descriptor evidence. Never a detection identity key.

The grammar is deliberately narrower than all bank/VPA formats. Extracted
identifiers stay internal: callers should expose rule explanations, not values.
"""

import re
from dataclasses import dataclass
from unicodedata import normalize

RULE_VERSION = "task2a-v1"
MAX_DESCRIPTOR_LENGTH = 250  # Same descriptor bound as private statement mapping.
CHANNELS = frozenset({"UPI", "IMPS", "NEFT", "RTGS"})
REFERENCE = re.compile(r"(?<!\w)(?:UTR|RRN|REF|TXNID)(?!\w)\s*[:=#]?\s*([A-Z0-9]{6,35})(?![\w.@-])")
VPA_TOKEN = re.compile(r"[^\s/|,;:()]+")
VPA = re.compile(r"[A-Z0-9](?:[A-Z0-9._-]{0,62}[A-Z0-9])?@[A-Z][A-Z0-9-]{1,31}")


@dataclass(frozen=True)
class DescriptorEvidence:
    raw_descriptor: str
    comparison_text: str
    channels: tuple[str, ...]
    references: tuple[str, ...]
    vpas: tuple[str, ...]
    ambiguous: bool
    rule_version: str = RULE_VERSION


def comparison_text(value: str) -> str:
    """Canonical token spacing; meaningful letters and digits are retained."""
    value = normalize("NFKC", normalize("NFKC", value).upper())
    return " ".join("".join(char if char.isalnum() else " " for char in value).split())


def descriptor_evidence(descriptor: str) -> DescriptorEvidence:
    if len(descriptor) > MAX_DESCRIPTOR_LENGTH:
        return DescriptorEvidence(descriptor, "", (), (), (), True)
    text = normalize("NFKC", normalize("NFKC", descriptor).upper())
    if len(text) > MAX_DESCRIPTOR_LENGTH:
        return DescriptorEvidence(descriptor, "", (), (), (), True)
    vpas = []
    references = []
    ambiguous = False

    def extract_vpa(match):
        nonlocal ambiguous
        token = match[0]
        if "@" not in token:
            return token
        if VPA.fullmatch(token) and ".." not in token:
            vpas.append(token)
        else:
            ambiguous = True
        # Never turn a payment address (valid or malformed) into a merchant.
        return " "

    text = VPA_TOKEN.sub(extract_vpa, text)

    def extract_reference(match):
        # Short digit-bearing brands are not reference evidence, even after a
        # label. This deliberately leaves many unsupported bank formats intact.
        if sum(char.isdigit() for char in match[1]) < 6:
            return match[0]
        references.append(match[1])
        return " "

    # Canonicalize separators before labelled extraction, so another pass
    # cannot reveal a reference hidden behind a slash or hyphen on this pass.
    text = REFERENCE.sub(extract_reference, comparison_text(text))
    tokens = text.split()
    channels = []
    # Prefix chains are ambiguous, but remove the whole chain so comparison
    # text is canonical on a second pass. Embedded channel words stay.
    while tokens and tokens[0] in CHANNELS:
        channels.append(tokens.pop(0))
    return DescriptorEvidence(
        descriptor, " ".join(tokens), tuple(channels), tuple(references),
        tuple(sorted(set(vpas))), ambiguous or len(set(vpas)) > 1 or len(channels) > 1,
    )
