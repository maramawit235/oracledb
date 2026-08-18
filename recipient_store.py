"""
recipient_store.py
Persistent storage for dynamically-managed alert email recipients.

Recipients configured via ALERT_RECIPIENT_EMAILS in .env are the "baseline"
list, set once at deploy time. This module manages an ADDITIONAL list that
DBAs can self-manage at runtime (add/remove their own email) without
touching .env or restarting the service. The two lists are merged at
send-time in alert_engine.EmailNotificationChannel.

Storage is a simple JSON file rather than a database table, matching the
project's existing lightweight config style (see rules.yaml). This keeps
the feature dependency-free -- no schema migration, no new DB connection.
"""

import json
import logging
import os
import re
import threading
from datetime import datetime, timezone
from typing import Dict, List

logger = logging.getLogger("ohis.recipient_store")

_LOCK = threading.Lock()
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _store_path() -> str:
    # Resolved lazily (not at import time) so tests can override the env var per-test.
    return os.getenv("RECIPIENTS_STORE_PATH", "data/alert_recipients.json")


def _read_raw() -> List[Dict]:
    path = _store_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            logger.warning(f"[RecipientStore] {path} did not contain a list, ignoring contents.")
            return []
    except (json.JSONDecodeError, OSError) as e:
        logger.error(f"[RecipientStore] Failed to read {path}: {e}")
        return []


def _write_raw(entries: List[Dict]) -> None:
    path = _store_path()
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(path, "w") as f:
        json.dump(entries, f, indent=2)


def is_valid_email(email: str) -> bool:
    return bool(_EMAIL_RE.match(email.strip())) if email else False


def list_recipients() -> List[Dict]:
    """Returns the full recipient records: [{"email": ..., "added_at": ...}, ...]"""
    with _LOCK:
        return _read_raw()


def list_recipient_emails() -> List[str]:
    """Returns just the email addresses, for merging into EmailNotificationChannel."""
    return [entry["email"] for entry in list_recipients()]


def add_recipient(email: str) -> Dict:
    """Adds an email if not already present (case-insensitive). Returns the
    resulting record. Raises ValueError on invalid input."""
    email = (email or "").strip()
    if not is_valid_email(email):
        raise ValueError(f"'{email}' is not a valid email address.")

    with _LOCK:
        entries = _read_raw()
        if any(e["email"].lower() == email.lower() for e in entries):
            logger.debug(f"[RecipientStore] {email} already present, no-op.")
            return next(e for e in entries if e["email"].lower() == email.lower())

        record = {"email": email, "added_at": datetime.now(timezone.utc).isoformat()}
        entries.append(record)
        _write_raw(entries)
        logger.info(f"[RecipientStore] Added recipient: {email}")
        return record


def remove_recipient(email: str) -> bool:
    """Removes an email (case-insensitive). Returns True if something was removed."""
    email = (email or "").strip().lower()
    with _LOCK:
        entries = _read_raw()
        remaining = [e for e in entries if e["email"].lower() != email]
        if len(remaining) == len(entries):
            return False
        _write_raw(remaining)
        logger.info(f"[RecipientStore] Removed recipient: {email}")
        return True
