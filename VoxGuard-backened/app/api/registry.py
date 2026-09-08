import re
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(tags=["registry"])

class NumberRequest(BaseModel):
    phone_number: str = Field(min_length=7, max_length=20)

class DeviceRequest(BaseModel):
    imei: str | None = Field(default=None, max_length=32)
    device_id: str | None = Field(default=None, max_length=128)

@router.post("/registry/number")
def verify_number(payload: NumberRequest):
    number = re.sub(r"\D", "", payload.phone_number)
    return {"phone_number": payload.phone_number, "normalized": number, "known": False, "risk": 35, "source": "prototype_registry"}

@router.post("/registry/device")
def verify_device(payload: DeviceRequest):
    value = payload.imei or payload.device_id
    return {"identifier_present": bool(value), "risk": 20 if value else 50, "source": "prototype_device_registry"}
