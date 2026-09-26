import json
from http.server import BaseHTTPRequestHandler
from packsmart_engine import save_analysis


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            record = json.loads(self.rfile.read(length))

            required = {
                "commodity",
                "topRecommendation",
                "shelfLife",
                "materialSpec",
                "sustainability"
            }

            missing = sorted(required - record.keys())

            if missing:
                self._send(400, {
                    "error": f"Missing fields: {', '.join(missing)}"
                })
                return

            saved = save_analysis(record)

            self._send(201, {
                "analysisId": saved["analysisId"],
                "batchId": saved["batchId"],
                "timestamp": saved["timestamp"],
                "engineVersion": saved["engineVersion"]
            })

        except Exception as error:
            self._send(400, {
                "error": f"Invalid analysis record: {error}"
            })

    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Request-ID")
        self.end_headers()
