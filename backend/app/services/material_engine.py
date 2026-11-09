import json
from pathlib import Path

DATA=json.loads((Path(__file__).parents[1]/"data"/"materials.json").read_text())
MATERIALS={x["id"]:x for x in DATA}

STATUS_LABELS={"generally_recyclable":"Generally recyclable","conditionally_recyclable":"Conditionally recyclable","special_collection":"Special collection required","not_conventional":"Not conventionally recyclable","unknown":"Unknown"}

def assess_component(component: dict) -> dict:
    material_id=str(component.get("material_id","UNKNOWN")).upper()
    material=MATERIALS.get(material_id)
    if not material:
        return {**component,"material_id":material_id,"recycling_status":"unknown","status_label":STATUS_LABELS["unknown"],"technical_explanation":"Material is not in the reference knowledge base; verify before sorting.","recommended_process":"Consult a qualified local waste handler."}
    status=material.get("recycling_status","unknown")
    return {**component,"material_id":material_id,"family":material.get("family"),"recycling_status":status,"status_label":STATUS_LABELS.get(status,status),"technical_explanation":material.get("notes",""),"recommended_process":material.get("process",""),"contamination":material.get("contamination","")}

def recovery_scenarios(components: list[dict], total_weight_g: float | None) -> list[dict]:
    if total_weight_g is None or total_weight_g <= 0:
        return []
    weighted=[c for c in components if c.get("weight_fraction") is not None]
    if not weighted:
        if len(components)==1: weighted=[{**components[0],"weight_fraction":1.0}]
        else: return []
    fraction_sum=sum(max(0,float(c["weight_fraction"])) for c in weighted)
    if fraction_sum <= 0: return []
    results=[]
    yields={"conservative":0.55,"expected":0.72,"optimistic":0.85}
    for c in weighted:
        fraction=max(0,float(c["weight_fraction"]))/fraction_sum
        input_g=total_weight_g*fraction
        results.append({"component_name":c["component_name"],"material_id":c["material_id"],"input_g":round(input_g,2),"conservative_g":round(input_g*yields["conservative"],2),"expected_g":round(input_g*yields["expected"],2),"optimistic_g":round(input_g*yields["optimistic"],2),"yield_assumptions":yields})
    return results

def recommendations(recovery: list[dict]) -> list[dict]:
    pathways={"PET":("rPET flakes / polyester fibre",1000,"Sorting, washing, shredding and extrusion"),"HDPE":("Recycled HDPE sheet or non-food container",1000,"Sorting, washing, shredding and extrusion"),"PP":("Recycled PP moulded products",1000,"Sorting, washing, compounding and moulding"),"PAPER":("Recycled paper pulp and board",5000,"Sorting, pulping, screening and de-inking as needed"),"CARDBOARD":("Recycled paperboard",5000,"Baling, pulping, screening and sheet forming"),"GLASS":("Glass cullet",10000,"Sorting by colour, contaminant removal and crushing"),"ALUMINIUM":("Secondary aluminium ingot",10000,"Sorting, decoating and controlled remelting"),"STEEL":("Recycled steel feedstock",10000,"Magnetic separation, preparation and remelting"),"COPPER":("Copper scrap feedstock",1000,"Cable stripping, sorting and refining")}
    out=[]
    for item in recovery:
        key=item["material_id"].upper()
        if key in pathways:
            name,minimum,process=pathways[key]
            out.append({"product_name":name,"material_id":key,"minimum_input_g":minimum,"available_material_g":item["expected_g"],"expected_output_g":item["expected_g"],"processing_requirements":process,"machinery":"Depends on throughput and local processor requirements","feasibility":"Indicative only; confirm contamination, batch size, market and permits"})
    return out
