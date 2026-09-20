"""PackSmart recommendation API.

Run with: python backend.py
Then open http://localhost:8000/
"""

import json
import math
import mimetypes
import uuid
from datetime import datetime, timezone
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ANALYSIS_DIR = ROOT / "data" / "analyses"
ENGINE_VERSION = "packsmart-topsis-1.2"

MATERIALS = [
    {"id": "ldpe", "name": "LDPE (Low-Density Polyethylene)", "otr": 8000, "wvtr": 15, "tempRange": [-40, 80], "greaseResistance": False, "lowTempFlex": True, "costPerM2": 5.0, "recyclable": True, "biodegradable": False, "carbonFootprint": 1.8, "desc": "Excellent moisture barrier, high gas permeability. Good for general produce."},
    {"id": "hdpe", "name": "HDPE (High-Density Polyethylene)", "otr": 2000, "wvtr": 5, "tempRange": [-40, 120], "greaseResistance": False, "lowTempFlex": True, "costPerM2": 6.0, "recyclable": True, "biodegradable": False, "carbonFootprint": 1.9, "desc": "Stiffer than LDPE, better moisture and gas barrier."},
    {"id": "pet", "name": "PET (Polyethylene Terephthalate)", "otr": 50, "wvtr": 10, "tempRange": [-40, 200], "greaseResistance": True, "lowTempFlex": True, "costPerM2": 12.0, "recyclable": True, "biodegradable": False, "carbonFootprint": 2.2, "desc": "Excellent clarity, good gas barrier. Common for bottles and trays."},
    {"id": "bopp", "name": "BOPP (Biaxially Oriented Polypropylene)", "otr": 1500, "wvtr": 4, "tempRange": [-30, 130], "greaseResistance": True, "lowTempFlex": False, "costPerM2": 9.0, "recyclable": True, "biodegradable": False, "carbonFootprint": 2.0, "desc": "Excellent moisture barrier, clarity and strength. Good for snacks."},
    {"id": "nylon", "name": "Nylon/PA (Polyamide)", "otr": 30, "wvtr": 200, "tempRange": [-40, 200], "greaseResistance": True, "lowTempFlex": True, "costPerM2": 25.0, "recyclable": False, "biodegradable": False, "carbonFootprint": 6.5, "desc": "Excellent gas barrier, poor moisture barrier. Used for vacuum packing meats."},
    {"id": "evoh", "name": "EVOH", "otr": 1, "wvtr": 150, "tempRange": [-40, 120], "greaseResistance": True, "lowTempFlex": True, "costPerM2": 40.0, "recyclable": False, "biodegradable": False, "carbonFootprint": 5.0, "desc": "Outstanding gas barrier when dry. Often sandwiched in multi-layers."},
    {"id": "al_foil", "name": "Aluminum Foil", "otr": 0.1, "wvtr": 0.1, "tempRange": [-40, 300], "greaseResistance": True, "lowTempFlex": True, "costPerM2": 35.0, "recyclable": True, "biodegradable": False, "carbonFootprint": 8.0, "desc": "Absolute barrier to light, gas, and moisture."},
    {"id": "pla", "name": "PLA (Polylactic Acid)", "otr": 500, "wvtr": 300, "tempRange": [-20, 50], "greaseResistance": True, "lowTempFlex": False, "costPerM2": 18.0, "recyclable": True, "biodegradable": True, "carbonFootprint": 1.2, "desc": "Bio-based plastic, good clarity but poor barrier properties. Good for short shelf life."},
    {"id": "paper", "name": "Kraft Paper (Uncoated)", "otr": 100000, "wvtr": 10000, "tempRange": [-10, 80], "greaseResistance": False, "lowTempFlex": True, "costPerM2": 4.0, "recyclable": True, "biodegradable": True, "carbonFootprint": 1.0, "desc": "No barrier, but highly sustainable. Good for dry goods like flour."},
    {"id": "micro_pe", "name": "Micro-perforated PE", "otr": 50000, "wvtr": 15, "tempRange": [-20, 60], "greaseResistance": False, "lowTempFlex": True, "costPerM2": 15.0, "recyclable": True, "biodegradable": False, "carbonFootprint": 2.0, "desc": "Customized high OTR for respiring fresh produce (MAP)."},
    {"id": "met_pet", "name": "Metalized PET", "otr": 2, "wvtr": 1, "tempRange": [-40, 150], "greaseResistance": True, "lowTempFlex": True, "costPerM2": 14.0, "recyclable": False, "biodegradable": False, "carbonFootprint": 3.5, "desc": "Very high barrier to gas, moisture, and light. Cheaper than pure foil."},
    {"id": "glass", "name": "Glass", "otr": 0.1, "wvtr": 0.1, "tempRange": [-40, 500], "greaseResistance": True, "lowTempFlex": True, "costPerM2": 50.0, "recyclable": True, "biodegradable": False, "carbonFootprint": 4.5, "desc": "Absolute barrier, reusable, but heavy and fragile."},
]


def sustainability_score(material):
    score = 40 if material["recyclable"] else 0
    if material["id"] in {"met_pet", "evoh"}:
        score -= 20
    if material["biodegradable"]:
        score += 30
    score += max(0, 30 - material["carbonFootprint"] / 10 * 30)
    return round(score)


def sustainability_breakdown(material):
    recyclable = 40 if material["recyclable"] else 0
    if material["id"] in {"met_pet", "evoh"}:
        recyclable -= 20
    biodegradable = 30 if material["biodegradable"] else 0
    carbon = round(max(0, 30 - material["carbonFootprint"] / 10 * 30))
    return {"recyclability": recyclable, "biodegradability": biodegradable, "carbon": carbon, "total": recyclable + biodegradable + carbon}


def hard_filter(commodity):
    survivors, rejections, rejection_details = [], {}, {}
    for material in MATERIALS:
        reason = ""
        rule = ""
        if not material["tempRange"][0] <= commodity["temp"] <= material["tempRange"][1]:
            rule = "temperature_range"
            reason = f'Material temperature range ({material["tempRange"][0]}°C to {material["tempRange"][1]}°C) cannot support storage at {commodity["temp"]}°C.'
        elif (commodity["aw"] > 0.6 or commodity["respiration"] > 0) and material["id"] == "paper":
            rule = "water_activity_barrier"
            reason = "High moisture/respiration commodities cannot use uncoated paper due to lack of barrier."
        elif commodity["fat"] > 5 and not material["greaseResistance"]:
            rule = "grease_resistance"
            reason = "Commodity has high fat content, but material lacks grease resistance."
        elif commodity["temp"] < 0 and not material["lowTempFlex"]:
            rule = "low_temperature_flexibility"
            reason = "Frozen storage requires low-temperature flexibility which this material lacks."
        elif commodity["category"] in {"fruit", "veg"} and commodity["respiration"] > 0 and commodity.get("pkgArea"):
            required_otr = commodity["respiration"] * 24 / (commodity["pkgArea"] * 0.16)
            if material["otr"] < required_otr * 0.25:
                rule = "oxygen_transmission"
                threshold = required_otr * 0.25
                reason = f'Film OTR ({material["otr"]} cc/m²/day) < required minimum ({threshold:.0f} cc/m²/day); respiration demand is {required_otr:.0f} cc/m²/day.'
        elif commodity["aw"] > 0.6 and material["wvtr"] > 50:
            rule = "water_vapor_transmission"
            reason = f'Film WVTR ({material["wvtr"]} g/m²/day) > maximum 50 g/m²/day for water activity {commodity["aw"]:.2f}.'
        elif commodity.get("budget") and material["costPerM2"] > commodity["budget"]:
            rule = "budget"
            reason = f'Material cost (₹{material["costPerM2"]}/m²) > budget ceiling (₹{commodity["budget"]}/m²).'
        if reason:
            rejections[material["id"]] = reason
            rejection_details[material["id"]] = {"rule": rule, "message": reason}
        else:
            survivors.append(dict(material))
    return survivors, rejections, rejection_details


def raw_metrics(commodity, material):
    if commodity["category"] in {"fruit", "veg"}:
        barrier = 100 if material["otr"] > 1000 else 10 if material["otr"] < 100 else 50
    else:
        wvtr = 100 if material["wvtr"] < 10 else 50 if material["wvtr"] < 50 else 10
        otr = 100 if material["otr"] < 100 else 50 if material["otr"] < 1000 else 10
        barrier = (wvtr + otr) / 2
    mechanical = 100 if ((commodity["category"] == "dairy" and material["id"] == "pet") or (commodity["category"] == "grain" and material["id"] in {"bopp", "ldpe"}) or (commodity["category"] == "meat" and material["id"] == "nylon")) else 50
    return {"barrier": barrier, "cost": material["costPerM2"], "sustainability": sustainability_score(material), "mechanical": mechanical}


def normalized_weights(priority="balanced"):
    presets = {
        "balanced": {"barrier": 30, "cost": 20, "sustainability": 25, "mechanical": 25},
        "cost": {"barrier": 30, "cost": 40, "sustainability": 15, "mechanical": 15},
        "shelf": {"barrier": 45, "cost": 15, "sustainability": 20, "mechanical": 20},
        "sustainability": {"barrier": 20, "cost": 15, "sustainability": 45, "mechanical": 20},
    }
    selected = presets.get(priority, presets["balanced"])
    total = sum(selected.values()) or 1
    return {key: value / total for key, value in selected.items()}


def recommend(commodity):
    weights_by_name = normalized_weights(commodity.get("priority", "balanced"))
    candidates, rejections, rejection_details = hard_filter(commodity)
    if not candidates:
        return {"recommendations": [], "rejections": rejections, "rejectionDetails": rejection_details, "explanation": "No materials passed all physical constraints.", "debug": {"requestId": str(uuid.uuid4()), "input": commodity, "candidates": [], "rejections": rejection_details}}
    if len(candidates) == 1:
        candidates[0]["topsisScore"] = 1.0
        candidates[0]["topsisRank"] = 1
        metrics = raw_metrics(commodity, candidates[0])
        candidates[0]["metrics"] = metrics
        candidates[0]["weights"] = weights_by_name
        top = candidates[0]
        explanation = f'{top["name"]} is the only material that passes the physical constraints for {commodity["name"]}, so it receives TOPSIS 100.0%. Its computed barrier score is {metrics["barrier"]:.0f}/100 and sustainability is {metrics["sustainability"]}/100.'
        if rejections:
            rejected_id = next(iter(rejections))
            rejected = next(material for material in MATERIALS if material["id"] == rejected_id)
            explanation += f'<br><br><em>Filter evidence:</em> {rejected["name"]} was rejected because {rejection_details[rejected_id]["message"]}'
        debug_candidates = []
        for material in MATERIALS:
            candidate = {"id": material["id"], "name": material["name"], "status": "rejected" if material["id"] in rejections else "eligible", "rawScores": raw_metrics(commodity, material)}
            if material["id"] in rejections:
                candidate["rejection"] = rejection_details[material["id"]]
            else:
                candidate["topsisScore"] = 1.0
                candidate["rank"] = 1
            debug_candidates.append(candidate)
        return {"recommendations": candidates, "rejections": rejections, "rejectionDetails": rejection_details, "weights": weights_by_name, "explanation": explanation, "debug": {"requestId": str(uuid.uuid4()), "input": commodity, "candidates": debug_candidates, "rejections": rejection_details}}
    rows = []
    for material in candidates:
        rows.append(list(raw_metrics(commodity, material).values()))
    weights = [weights_by_name[key] for key in ("barrier", "cost", "sustainability", "mechanical")]
    normalized = []
    for i, row in enumerate(rows):
        normalized.append([row[j] / (sum(item[j] ** 2 for item in rows) ** 0.5 or 1) for j in range(4)])
    weighted = [[value * weights[j] for j, value in enumerate(row)] for row in normalized]
    ideal_best = [max(column) if j != 1 else min(column) for j, column in enumerate(zip(*weighted))]
    ideal_worst = [min(column) if j != 1 else max(column) for j, column in enumerate(zip(*weighted))]
    for material, row, raw in zip(candidates, weighted, rows):
        plus = math.sqrt(sum((row[j] - ideal_best[j]) ** 2 for j in range(4)))
        minus = math.sqrt(sum((row[j] - ideal_worst[j]) ** 2 for j in range(4)))
        material["topsisScore"] = 0 if plus + minus == 0 else minus / (plus + minus)
        material["metrics"] = {"barrier": raw[0], "cost": raw[1], "sustainability": raw[2], "mechanical": raw[3]}
        material["weights"] = weights_by_name
    candidates.sort(key=lambda item: item["topsisScore"], reverse=True)
    for rank, material in enumerate(candidates, 1):
        material["topsisRank"] = rank
    top = candidates[0]
    explanation = f'{top["name"]} ranks first for {commodity["name"]} at TOPSIS {top["topsisScore"] * 100:.1f}%. Its computed barrier score is {top["metrics"]["barrier"]:.0f}/100, sustainability is {top["metrics"]["sustainability"]}/100, and material cost is ₹{top["metrics"]["cost"]:.2f}/m².'
    if rejections:
        rejected_id = next(iter(rejections))
        rejected = next(material for material in MATERIALS if material["id"] == rejected_id)
        explanation += f'<br><br><em>Filter evidence:</em> {rejected["name"]} was rejected because {rejection_details[rejected_id]["message"]}'
    debug_candidates = []
    for material in MATERIALS:
        candidate = {"id": material["id"], "name": material["name"], "status": "rejected" if material["id"] in rejections else "eligible", "rawScores": raw_metrics(commodity, material)}
        if material["id"] in rejections:
            candidate["rejection"] = rejection_details[material["id"]]
        else:
            ranked_material = next(item for item in candidates if item["id"] == material["id"])
            candidate["topsisScore"] = ranked_material["topsisScore"]
            candidate["rank"] = ranked_material["topsisRank"]
        debug_candidates.append(candidate)
    return {"recommendations": candidates[:3], "rejections": rejections, "rejectionDetails": rejection_details, "weights": weights_by_name, "explanation": explanation, "debug": {"requestId": str(uuid.uuid4()), "input": commodity, "candidates": debug_candidates, "rejections": rejection_details}}


def save_analysis(record):
    analysis_id = uuid.uuid4().hex[:16]
    record = dict(record)
    record.update({
        "analysisId": analysis_id,
        "batchId": f"PS-{datetime.now(timezone.utc):%Y%m%d}-{analysis_id[:6].upper()}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "engineVersion": ENGINE_VERSION,
    })
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    (ANALYSIS_DIR / f"{analysis_id}.json").write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    return record


def load_analysis(analysis_id):
    if not analysis_id or not analysis_id.isalnum() or len(analysis_id) != 16:
        return None
    path = ANALYSIS_DIR / f"{analysis_id}.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def trace_page(record):
    commodity = record["commodity"]
    top = record["topRecommendation"]
    material = record["materialSpec"]
    sustainability = record["sustainability"]
    shelf = record["shelfLife"]
    map_result = record.get("map", {})
    geometry = record.get("packageGeometry", {})
    confidence = record.get("confidence", {})
    test_conditions = record.get("testConditions", {})
    trace_data = json.dumps(record, ensure_ascii=False).replace("</", "<\\/")
    technical_rows = "".join(
        f'<tr><td>{escape(item["name"])}</td><td>{item["status"]}</td><td>{item["rawScores"]["barrier"]}</td><td>{item["rawScores"]["cost"]}</td><td>{item["rawScores"]["sustainability"]}</td><td>{item.get("topsisScore", "-")}</td><td>{escape(item.get("rejection", {}).get("message", "-"))}</td></tr>'
        for item in record.get("candidates", [])
    )
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PackSmart Traceability</title>
<style>
:root {{ color-scheme: light; --ink:#183847; --muted:#66808a; --sage:#edf3ed; --teal:#5f9188; --paper:#f7f6f0; --line:#cbd8d2; }}
* {{ box-sizing:border-box; }} body {{ margin:0; background:var(--paper); color:var(--ink); font:16px/1.55 Arial,sans-serif; }} main {{ max-width:980px; margin:0 auto; padding:32px 20px 64px; }} .eyebrow {{ color:var(--teal); font-size:12px; letter-spacing:.16em; text-transform:uppercase; }} h1 {{ font-size:clamp(2rem,5vw,3.8rem); line-height:1.05; margin:.4rem 0 1rem; }} h2 {{ margin-top:0; }} .hero, section {{ background:rgba(255,255,255,.65); border:1px solid var(--line); border-radius:16px; padding:24px; margin:16px 0; }} .hero {{ background:var(--sage); }} .grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }} .fact {{ background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px; }} .label {{ color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }} .value {{ font-weight:700; font-size:1.1rem; }} .trust {{ color:var(--teal); font-weight:700; }} button {{ border:0; border-radius:8px; background:var(--ink); color:white; padding:11px 16px; cursor:pointer; }} #technical {{ display:none; }} table {{ width:100%; border-collapse:collapse; font-size:13px; }} th,td {{ padding:8px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }} .table-wrap {{ overflow:auto; }}
</style></head><body><main>
<div class="hero"><div class="eyebrow">PackSmart AI traceability</div><h1>{escape(commodity["name"])}</h1><p>{escape(commodity["category"].title())} product with a packaging decision recorded for batch <strong>{escape(record["batchId"])}</strong>.</p><p class="trust">✓ AI-analyzed using {escape(record["engineVersion"])}</p></div>
<section><h2>Packaging at a glance</h2><div class="grid"><div class="fact"><div class="label">Recommended material</div><div class="value">{escape(top["name"])}</div><p>Chosen because its barrier and cost profile best protect this product while meeting the physical constraints.</p></div><div class="fact"><div class="label">Best before</div><div class="value">{escape(shelf["expiryDate"])}</div><p>Predicted shelf life: {shelf["predictedDays"]} days.</p></div><div class="fact"><div class="label">Storage</div><div class="value">{commodity["temp"]}°C or below</div><p>Relative humidity: {commodity["rh"]}% or below.</p></div><div class="fact"><div class="label">Material impact</div><div class="value">{'♻ Recyclable' if material["recyclable"] else '⚠ Not widely recyclable'} {'· Biodegradable' if material["biodegradable"] else '· Not biodegradable'}</div><p>Sustainability score: {sustainability["total"]}/100.</p></div></div></section>
<section><div class="grid"><div><div class="label">Batch number</div><div class="value">{escape(record["batchId"])}</div></div><div><div class="label">Pack date</div><div class="value">{escape(shelf["packDate"])}</div></div></div></section>
<section><button id="technical-toggle" type="button">View technical specs</button></section>
<section id="technical"><h2>Technical record</h2><div class="grid"><div class="fact"><div class="label">Recommendation and review</div><p>Recommendation ID: {escape(record["analysisId"])}<br>Review status: {escape(record.get("reviewStatus", "Preliminary screening"))}<br>Confidence: {escape(str(confidence.get("level", "Screening")))} ({float(confidence.get("score", 0)) * 100:.1f}%)<br>Uncertainty: {escape(str(confidence.get("uncertainty", "")))}</p></div><div class="fact"><div class="label">Original inputs</div><pre>{escape(json.dumps(commodity, indent=2, ensure_ascii=False))}</pre></div><div class="fact"><div class="label">Package format and geometry</div><p>Format: {escape(str(record.get("packageFormat", "Flexible film or pouch")))}<br>Surface area: {geometry.get("surfaceAreaM2", "-")} m²<br>Package weight: {geometry.get("packageWeightKg", "-")} kg<br>Recommended structure: {escape(material["name"])}</p></div><div class="fact"><div class="label">Material specification and test conditions</div><p>OTR: {material["otr"]} cc/m²/day<br>WVTR: {material["wvtr"]} g/m²/day<br>Cost: ₹{material["costPerM2"]}/m²<br>Grease resistance: {material["greaseResistance"]}<br>Low-temperature flexibility: {material["lowTempFlex"]}<br>Test temperature: {test_conditions.get("temperatureC", commodity["temp"])}°C<br>Test RH: {test_conditions.get("relativeHumidityPercent", commodity["rh"])}%</p></div><div class="fact"><div class="label">Sustainability breakdown</div><p>Recyclability: {sustainability["recyclability"]}<br>Biodegradability: {sustainability["biodegradability"]}<br>Carbon impact: {sustainability["carbon"]}<br>Total: {sustainability["total"]}/100</p></div><div class="fact"><div class="label">MAP calculation</div><pre>{escape(json.dumps(map_result.get("specs", {}), indent=2, ensure_ascii=False))}</pre></div></div><h3>Laboratory validation checklist</h3><ul>{''.join(f'<li>{escape(item)}</li>' for item in record.get("laboratoryValidationChecklist", []))}</ul><h3>All material evaluations</h3><div class="table-wrap"><table><thead><tr><th>Material</th><th>Status</th><th>Barrier</th><th>Cost</th><th>Sustainability</th><th>TOPSIS</th><th>Elimination reason</th></tr></thead><tbody>{technical_rows}</tbody></table></div><p class="label">Computed {escape(record["timestamp"])} · Engine {escape(record["engineVersion"])} · Database {escape(record.get("databaseVersion", "unknown"))}</p><p><strong>Preliminary screening result. Not a production release or shelf-life certificate.</strong></p></section>
<script>const record={trace_data};document.getElementById('technical-toggle').addEventListener('click',function(){{const panel=document.getElementById('technical');const open=panel.style.display==='block';panel.style.display=open?'none':'block';this.textContent=open?'View technical specs':'Hide technical specs';}});</script>
</main></body></html>'''


class RequestHandler(BaseHTTPRequestHandler):
    def _send(self, status, payload, content_type="application/json"):
        body = json.dumps(payload).encode("utf-8") if content_type == "application/json" else (payload.encode("utf-8") if isinstance(payload, str) else payload)
        self.send_response(status)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, b"", "text/plain")

    def do_POST(self):
        if self.path == "/api/analysis":
            try:
                length = int(self.headers.get("Content-Length", 0))
                record = json.loads(self.rfile.read(length))
                required = {"commodity", "topRecommendation", "shelfLife", "materialSpec", "sustainability"}
                missing = sorted(required - record.keys())
                if missing:
                    self._send(400, {"error": f"Missing fields: {', '.join(missing)}"})
                    return
                saved = save_analysis(record)
                self._send(201, {"analysisId": saved["analysisId"], "batchId": saved["batchId"], "timestamp": saved["timestamp"], "engineVersion": saved["engineVersion"]})
            except (ValueError, TypeError, json.JSONDecodeError) as error:
                self._send(400, {"error": f"Invalid analysis record: {error}"})
            return
        if self.path != "/api/recommend":
            self._send(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            commodity = json.loads(self.rfile.read(length))
            required = {"category", "aw", "respiration", "fat", "temp"}
            missing = sorted(required - commodity.keys())
            if missing:
                self._send(400, {"error": f"Missing fields: {', '.join(missing)}"})
                return
            result = recommend(commodity)
            result["debug"]["requestId"] = self.headers.get("X-Request-ID") or result["debug"]["requestId"]
            self._send(200, result)
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
            self._send(400, {"error": f"Invalid request: {error}"})

    def do_GET(self):
        requested = self.path.split("?", 1)[0]
        if requested.startswith("/p/q/") or requested.startswith("/trace/"):
            record = load_analysis(requested.rsplit("/", 1)[-1])
            if not record:
                self._send(404, b"Traceability record not found.", "text/plain")
            else:
                self._send(200, trace_page(record), "text/html")
            return
        relative = "index.html" if requested in {"", "/", "/index.html"} else requested.lstrip("/")
        file_path = (ROOT / relative).resolve()
        if ROOT not in file_path.parents and file_path != ROOT:
            self._send(403, {"error": "Forbidden"})
        elif file_path.is_file():
            content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            self._send(200, file_path.read_bytes(), content_type)
        else:
            self._send(404, {"error": "Not found"})

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    print("PackSmart API running at http://localhost:8000")
    ThreadingHTTPServer(("localhost", 8000), RequestHandler).serve_forever()