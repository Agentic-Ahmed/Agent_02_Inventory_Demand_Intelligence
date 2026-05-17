# Inventory Demand Intelligence System

This project is an AI-powered agentic system designed to orchestrate and automate inventory and demand forecasting.

## Architecture

The system uses a **Manager (Orchestrator-as-Tool)** pattern, where an **Inventory Intelligence Orchestrator** receives scheduled and real-time triggers, and coordinates specialist agents:
* **Demand Forecasting Agent**: Ingests sales history, seasonality, promotions, weather, and macro signals to output SKU-level forecasts.
* **Reorder & Supplier Agent**: Monitors stock levels against forecasts and triggers purchase orders or negotiations.

## Documentation

For full details, see the enclosed documentation: `Agent_02_Inventory_Demand_Intelligence.docx`.
