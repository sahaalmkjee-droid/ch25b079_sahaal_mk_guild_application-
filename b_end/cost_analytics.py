import datetime
from typing import List, Dict
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import CostLog, User, get_db
from auth import get_current_user_authenticated

COST_PER_MILLION_IN_INR = 6.25
COST_PER_MILLION_OUT_INR = 25.0

def record_cost(user_id: int, feature: str, tokens_in: int, tokens_out: int, db: Session):
    try:
        cost = (tokens_in / 1_000_000.0 * COST_PER_MILLION_IN_INR) + (tokens_out / 1_000_000.0 * COST_PER_MILLION_OUT_INR)
        log = CostLog(
            user_id=user_id,
            feature=feature,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_inr=cost,
            timestamp=datetime.datetime.utcnow()
        )
        db.add(log)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[CostLog Error] {e}")

class CostItem(BaseModel):
    feature: str
    tokens_in: int
    tokens_out: int
    cost_inr: float

class AnalyticsCostsResponse(BaseModel):
    total_tokens_in: int
    total_tokens_out: int
    total_cost_inr: float
    features: List[CostItem]

router = APIRouter(tags=["analytics"])

@router.get("/analytics/costs", response_model=AnalyticsCostsResponse)
def get_cost_analytics(
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    logs = db.query(CostLog).filter(CostLog.user_id == current_user.id).all()
    grouped: Dict[str, CostItem] = {}

    total_in = 0
    total_out = 0
    total_cost = 0.0

    for l in logs:
        total_in += l.tokens_in
        total_out += l.tokens_out
        total_cost += l.cost_inr

        if l.feature not in grouped:
            grouped[l.feature] = CostItem(
                feature=l.feature,
                tokens_in=0,
                tokens_out=0,
                cost_inr=0.0
            )
        grouped[l.feature].tokens_in += l.tokens_in
        grouped[l.feature].tokens_out += l.tokens_out
        grouped[l.feature].cost_inr = round(grouped[l.feature].cost_inr + l.cost_inr, 4)

    return AnalyticsCostsResponse(
        total_tokens_in=total_in,
        total_tokens_out=total_out,
        total_cost_inr=round(total_cost, 4),
        features=list(grouped.values())
    )
