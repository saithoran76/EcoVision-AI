from typing import Any

def estimate_weight(product: dict[str, Any], measured_weight_g: float | None = None) -> dict:
    if measured_weight_g is not None:
        if measured_weight_g <= 0:
            raise ValueError("Measured weight must be positive")
        return {"minimum_g": round(measured_weight_g, 2), "expected_g": round(measured_weight_g, 2), "maximum_g": round(measured_weight_g, 2), "confidence": "user_measured", "assumptions": ["User-provided scale measurement"]}
    # Images alone do not provide scale or material volume. Return unavailable rather than fabricating mass.
    return {"minimum_g": None, "expected_g": None, "maximum_g": None, "confidence": "unavailable", "assumptions": ["No scale reference or measured weight was provided; a photograph cannot establish mass."]}
