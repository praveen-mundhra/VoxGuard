from ai.risk_engine import risk_engine,RiskInputs
def test_high_risk(): assert risk_engine.calculate(RiskInputs(95,90,80,70,60,90))['risk_level']=='HIGH'
