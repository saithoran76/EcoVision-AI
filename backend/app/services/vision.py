import base64, json
import httpx
from app.core.config import settings

PROMPT = "Identify the visible waste product and only components/materials supported by visible evidence. Do not infer hidden layers. Return JSON with product_name, summary, components [{component_name, material_id, confidence, evidence, technical_explanation}]. Percentages are optional and must be omitted unless visually supported."

async def analyze_with_gemini(image_bytes: bytes, mime_type: str) -> dict:
    if not settings.gemini_api_key:
        raise RuntimeError("Gemini API key is not configured; live analysis is unavailable")
    url=f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    payload={"contents":[{"parts":[{"text":PROMPT},{"inline_data":{"mime_type":mime_type,"data":base64.b64encode(image_bytes).decode("ascii")}}]}],"generationConfig":{"responseMimeType":"application/json"}}
    async with httpx.AsyncClient(timeout=60) as client:
        response=await client.post(url,params={"key":settings.gemini_api_key},json=payload)
        response.raise_for_status()
        body=response.json()
    text=body["candidates"][0]["content"]["parts"][0]["text"]
    parsed=json.loads(text)
    if not isinstance(parsed.get("components"),list) or not parsed.get("product_name"):
        raise ValueError("Gemini response did not match the required schema")
    return parsed

def demo_analysis() -> dict:
    return {"product_name":"Demo PET beverage bottle","summary":"Synthetic demonstration fixture; this is not an analysis of the uploaded image.","components":[{"component_name":"Bottle body","material_id":"PET","confidence":0.96,"evidence":"Synthetic demo fixture","technical_explanation":"PET is commonly mechanically recycled where accepted and adequately sorted."},{"component_name":"Cap","material_id":"PP","confidence":0.75,"evidence":"Synthetic demo fixture","technical_explanation":"Cap polymers vary; confirm resin marking and local acceptance."}]}
