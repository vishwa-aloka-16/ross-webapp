class ExtractionReportBuilder:
    def build(self, *, profile: dict, quality: dict, warnings: list[str], used_legacy_fallback: bool) -> dict:
        return {
            "profile": profile,
            "quality": quality,
            "warnings": warnings,
            "used_legacy_fallback": used_legacy_fallback,
        }
