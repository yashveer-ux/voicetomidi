import time
from collections import defaultdict
from fastapi import Request, HTTPException
from functools import wraps

_counters: dict[str, list[float]] = defaultdict(list)
_WINDOW = 60.0


def _get_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP", "")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "unknown"


def rate_limit(max_requests: int):
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            ip = _get_ip(request)
            now = time.monotonic()
            window_start = now - _WINDOW
            _counters[ip] = [t for t in _counters[ip] if t > window_start]
            if len(_counters[ip]) >= max_requests:
                raise HTTPException(status_code=429, detail="Too many requests — try again in a minute")
            _counters[ip].append(now)
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator
