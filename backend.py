"""PackSmart recommendation API.

Run with: python backend.py
Then open http://localhost:8000/
"""

import json
import math
import mimetypes
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent

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


def recommend(commodity):
    candidates, rejections, rejection_details = hard_filter(commodity)
    if not candidates:
        return {"recommendations": [], "rejections": rejections, "rejectionDetails": rejection_details, "explanation": "No materials passed all physical constraints.", "debug": {"requestId": str(uuid.uuid4()), "input": commodity, "candidates": [], "rejections": rejection_details}}
    if len(candidates) == 1:
        candidates[0]["topsisScore"] = 1.0
        candidates[0]["topsisRank"] = 1
        metrics = raw_metrics(commodity, candidates[0])
        candidates[0]["metrics"] = metrics
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
        return {"recommendations": candidates, "rejections": rejections, "rejectionDetails": rejection_details, "explanation": explanation, "debug": {"requestId": str(uuid.uuid4()), "input": commodity, "candidates": debug_candidates, "rejections": rejection_details}}
    rows = []
    for material in candidates:
        rows.append(list(raw_metrics(commodity, material).values()))
    weights = [0.30, 0.20, 0.25, 0.25]
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
    return {"recommendations": candidates[:3], "rejections": rejections, "rejectionDetails": rejection_details, "explanation": explanation, "debug": {"requestId": str(uuid.uuid4()), "input": commodity, "candidates": debug_candidates, "rejections": rejection_details}}


class RequestHandler(BaseHTTPRequestHandler):
    def _send(self, status, payload, content_type="application/json"):
        body = json.dumps(payload).encode() if content_type == "application/json" else payload
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