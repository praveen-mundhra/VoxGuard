from pydantic import BaseModel


class TransactionContext(BaseModel):

    amount: float = 0

    beneficiary: str = ""

    new_beneficiary: bool = False

    transaction_type: str = "transfer"

    user_confirmed: bool = False

def transaction_risk(transaction):

    risk = 0

    if transaction.amount >= 10000:
        risk += 20

    if transaction.amount >= 50000:
        risk += 25

    if transaction.new_beneficiary:
        risk += 25

    if not transaction.user_confirmed:
        risk += 15

    return min(risk, 100)