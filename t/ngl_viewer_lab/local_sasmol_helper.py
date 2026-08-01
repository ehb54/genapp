#!/usr/bin/env python3
"""Serve the NGL lab and read selected local PDB/DCD files with Sasmol."""

from __future__ import annotations

import argparse
import cgi
import json
import os
import struct
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy
from sasmol.system import Molecule


MAX_UPLOAD_BYTES = 512 * 1024 * 1024


class LocalSasmolHandler(SimpleHTTPRequestHandler):
    server_version = "NglLocalSasmol/0.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/js/ngl.js":
            self.path = "/languages/html5/add/js/ngl.js"
        super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/local-sasmol/trajectory":
            self.send_error(404)
            return
        try:
            self.write_trajectory()
        except Exception as error:
            self.write_json(400, {"error": str(error)})

    def write_trajectory(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length < 1 or content_length > MAX_UPLOAD_BYTES:
            raise ValueError("PDB and DCD upload must be between 1 byte and 512 MiB")
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": self.headers.get("Content-Type", "")},
        )
        pdb_bytes = form.getvalue("structure")
        dcd_bytes = form.getvalue("trajectory")
        if not isinstance(pdb_bytes, bytes) or not isinstance(dcd_bytes, bytes):
            raise ValueError("both structure and trajectory files are required")
        with tempfile.TemporaryDirectory(prefix="ngl_sasmol_") as temporary_directory:
            pdb_path = Path(temporary_directory, "structure.pdb")
            dcd_path = Path(temporary_directory, "trajectory.dcd")
            pdb_path.write_bytes(pdb_bytes)
            dcd_path.write_bytes(dcd_bytes)
            molecule = Molecule(0)
            molecule.read_pdb(str(pdb_path))
            molecule.read_dcd(str(dcd_path))
            coordinates = numpy.asarray(molecule.coor(), dtype="<f4")
        if coordinates.ndim != 3 or coordinates.shape[0] < 1 or coordinates.shape[2] != 3:
            raise ValueError("Sasmol did not return trajectory coordinates")
        body = struct.pack("<4sII", b"NGLF", coordinates.shape[0], coordinates.shape[1]) + coordinates.tobytes(order="C")
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def write_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--root",
        default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
        help="GenApp repository root to serve",
    )
    args = parser.parse_args()
    os.chdir(args.root)
    server = ThreadingHTTPServer((args.host, args.port), LocalSasmolHandler)
    print("serving http://%s:%d/t/ngl_viewer_lab/" % (args.host, args.port), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
