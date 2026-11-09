from app.services.material_engine import assess_component, recovery_scenarios, recommendations
from app.services.weight import estimate_weight


def test_material_assessment():
    result = assess_component({"component_name": "body", "material_id": "PET", "confidence": 0.8})
    assert result["recycling_status"] == "generally_recyclable"
    assert result["status_label"] == "Generally recyclable"


def test_unknown_material_is_not_guessed():
    result = assess_component({"component_name": "layer", "material_id": "UNKNOWN"})
    assert result["recycling_status"] == "unknown"


def test_recovery_mass_balance():
    components = [
        {"component_name": "body", "material_id": "PET", "weight_fraction": 0.6},
        {"component_name": "cap", "material_id": "PP", "weight_fraction": 0.4},
    ]
    rows = recovery_scenarios(components, 100)
    assert len(rows) == 2
    assert round(sum(row["input_g"] for row in rows), 2) == 100
    assert round(sum(row["expected_g"] for row in rows), 2) == 72
    assert all(row["conservative_g"] <= row["expected_g"] <= row["optimistic_g"] for row in rows)


def test_recovery_requires_weight_for_multi_component_object():
    components = [
        {"component_name": "body", "material_id": "PET"},
        {"component_name": "cap", "material_id": "PP"},
    ]
    assert recovery_scenarios(components, None) == []


def test_weight_photo_uncertainty():
    result = estimate_weight("unfamiliar object")
    assert result["expected_g"] is None
    assert result["confidence"] == "unavailable"


def test_measured_weight():
    result = estimate_weight("bottle", 123.4)
    assert result["expected_g"] == 123.4
    assert result["confidence"] == "user_measured"


def test_recommendation_assumptions():
    recovery = recovery_scenarios(
        [{"component_name": "body", "material_id": "PET", "weight_fraction": 1.0}],
        2000,
    )
    result = recommendations(recovery)
    assert result
    assert "processing_requirements" in result[0]
    assert result[0]["minimum_input_g"] > 0
