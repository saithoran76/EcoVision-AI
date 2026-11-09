from pathlib import Path
from typing import Any

class ComputerVisionService:
    """Optional generic object detection adapter; not a chemical material classifier."""
    def __init__(self, weights: str | None = None):
        self.weights = weights
        self._model = None

    def detect(self, image_path: str) -> list[dict[str, Any]]:
        if not self.weights or not Path(self.weights).exists():
            return []
        try:
            from ultralytics import YOLO
            if self._model is None:
                self._model = YOLO(self.weights)
            results = self._model(image_path, verbose=False)
            items = []
            for result in results:
                for box in result.boxes:
                    cls = int(box.cls[0].item())
                    items.append({"class_id": cls, "label": self._model.names.get(cls, str(cls)), "confidence": float(box.conf[0].item()), "xyxy": [float(v) for v in box.xyxy[0].tolist()]})
            return items
        except Exception:
            return []
