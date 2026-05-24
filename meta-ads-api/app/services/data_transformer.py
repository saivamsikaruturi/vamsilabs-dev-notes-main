from datetime import date


def extract_action_value(actions: list[dict] | None, action_type: str) -> float:
    """Extract a specific action value from Meta's actions array."""
    if not actions:
        return 0.0
    for action in actions:
        if action.get("action_type") == action_type:
            return float(action.get("value", 0))
    return 0.0


def transform_account_insights(raw_data: dict) -> dict:
    """
    Transform raw Meta insights response into dashboard-friendly format.
    Maps Meta's nested actions/action_values into flat KPI structure.
    """
    data_points = raw_data.get("data", [])
    if not data_points:
        return {"kpis": {}, "daily_trend": []}

    totals = {
        "spend": 0, "impressions": 0, "clicks": 0,
        "reach": 0, "conversions": 0, "revenue": 0,
    }
    daily_trend = []

    for point in data_points:
        spend = float(point.get("spend", 0))
        impressions = int(point.get("impressions", 0))
        clicks = int(point.get("clicks", 0))
        reach = int(point.get("reach", 0))

        purchases = extract_action_value(point.get("actions"), "omni_purchase")
        if purchases == 0:
            purchases = extract_action_value(point.get("actions"), "purchase")

        revenue = extract_action_value(point.get("action_values"), "omni_purchase")
        if revenue == 0:
            revenue = extract_action_value(point.get("action_values"), "purchase")

        totals["spend"] += spend
        totals["impressions"] += impressions
        totals["clicks"] += clicks
        totals["reach"] += reach
        totals["conversions"] += int(purchases)
        totals["revenue"] += revenue

        daily_trend.append({
            "date": point.get("date_start"),
            "spend": spend,
            "revenue": revenue,
            "impressions": impressions,
            "clicks": clicks,
            "conversions": int(purchases),
        })

    ctr = (totals["clicks"] / totals["impressions"] * 100) if totals["impressions"] > 0 else 0
    cpc = (totals["spend"] / totals["clicks"]) if totals["clicks"] > 0 else 0
    cpa = (totals["spend"] / totals["conversions"]) if totals["conversions"] > 0 else 0
    roas = (totals["revenue"] / totals["spend"]) if totals["spend"] > 0 else 0

    return {
        "kpis": {
            "spend": round(totals["spend"], 2),
            "revenue": round(totals["revenue"], 2),
            "roas": round(roas, 2),
            "cpa": round(cpa, 2),
            "clicks": totals["clicks"],
            "ctr": round(ctr, 2),
            "impressions": totals["impressions"],
            "conversions": totals["conversions"],
            "reach": totals["reach"],
            "cpc": round(cpc, 2),
        },
        "daily_trend": daily_trend,
    }


def transform_campaigns(campaigns_data: dict, insights_data: list[dict]) -> list[dict]:
    """
    Merge campaign objects with their insights into a single flat structure.
    """
    insights_map = {}
    for insight in insights_data:
        cid = insight.get("campaign_id") or insight.get("id")
        if cid:
            insights_map[cid] = insight

    results = []
    for camp in campaigns_data.get("data", []):
        camp_id = camp.get("id")
        insight = insights_map.get(camp_id, {})

        spend = float(insight.get("spend", 0))
        impressions = int(insight.get("impressions", 0))
        clicks = int(insight.get("clicks", 0))
        purchases = extract_action_value(insight.get("actions"), "omni_purchase")
        if purchases == 0:
            purchases = extract_action_value(insight.get("actions"), "purchase")
        revenue = extract_action_value(insight.get("action_values"), "omni_purchase")
        if revenue == 0:
            revenue = extract_action_value(insight.get("action_values"), "purchase")

        ctr = (clicks / impressions * 100) if impressions > 0 else 0
        cpc = (spend / clicks) if clicks > 0 else 0
        cpa = (spend / purchases) if purchases > 0 else 0
        roas = (revenue / spend) if spend > 0 else 0

        daily_budget = float(camp.get("daily_budget", 0)) / 100  # Meta returns cents
        lifetime_budget = float(camp.get("lifetime_budget", 0)) / 100

        results.append({
            "id": camp_id,
            "name": camp.get("name", ""),
            "status": camp.get("effective_status", camp.get("status", "UNKNOWN")),
            "objective": camp.get("objective", ""),
            "daily_budget": daily_budget,
            "lifetime_budget": lifetime_budget,
            "spend": round(spend, 2),
            "impressions": impressions,
            "clicks": clicks,
            "ctr": round(ctr, 2),
            "cpc": round(cpc, 2),
            "cpa": round(cpa, 2),
            "conversions": int(purchases),
            "revenue": round(revenue, 2),
            "roas": round(roas, 2),
            "reach": int(insight.get("reach", 0)),
            "frequency": float(insight.get("frequency", 0)),
        })

    return sorted(results, key=lambda x: x["spend"], reverse=True)


def transform_breakdowns(raw_data: dict, breakdown_field: str) -> list[dict]:
    """Transform breakdown response into percentage-allocated segments."""
    data_points = raw_data.get("data", [])
    if not data_points:
        return []

    segments = {}
    total_spend = 0

    for point in data_points:
        key = point.get(breakdown_field, "Unknown")
        spend = float(point.get("spend", 0))
        segments[key] = segments.get(key, 0) + spend
        total_spend += spend

    results = []
    for name, spend in sorted(segments.items(), key=lambda x: x[1], reverse=True):
        pct = (spend / total_spend * 100) if total_spend > 0 else 0
        results.append({
            "name": name,
            "spend": round(spend, 2),
            "percentage": round(pct, 1),
        })

    return results


def build_funnel(insights_data: dict) -> list[dict]:
    """
    Build a conversion funnel from Meta's actions array.
    Stages: Impressions → Clicks → Add to Cart → Checkout → Purchase
    """
    data_points = insights_data.get("data", [])
    totals = {"impressions": 0, "clicks": 0, "add_to_cart": 0, "checkout": 0, "purchases": 0}

    for point in data_points:
        totals["impressions"] += int(point.get("impressions", 0))
        totals["clicks"] += int(point.get("clicks", 0))
        totals["add_to_cart"] += int(extract_action_value(point.get("actions"), "omni_add_to_cart"))
        totals["checkout"] += int(extract_action_value(point.get("actions"), "omni_initiated_checkout"))
        totals["purchases"] += int(extract_action_value(point.get("actions"), "omni_purchase"))

    base = totals["impressions"] or 1
    funnel = [
        {"stage": "Impressions", "value": totals["impressions"], "rate": 100.0},
        {"stage": "Link Clicks", "value": totals["clicks"], "rate": round(totals["clicks"] / base * 100, 3)},
        {"stage": "Add to Cart", "value": totals["add_to_cart"], "rate": round(totals["add_to_cart"] / base * 100, 3)},
        {"stage": "Initiate Checkout", "value": totals["checkout"], "rate": round(totals["checkout"] / base * 100, 3)},
        {"stage": "Purchases", "value": totals["purchases"], "rate": round(totals["purchases"] / base * 100, 3)},
    ]

    return funnel
