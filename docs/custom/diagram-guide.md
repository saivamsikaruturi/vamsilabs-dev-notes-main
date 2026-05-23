# Diagram Style Guide (Internal Reference)

## Design Principles

Based on UI/UX Pro Max analysis: **Swiss Minimalism + Editorial Premium**

- Diagrams render on warm cream canvas (`#F5F3F0`) in dark mode
- Use light fills with dark text — NOT dark fills with white text
- Brand amber (`#B45309`) used sparingly for key emphasis only
- Maximum 6-8 nodes per diagram for readability
- No emojis in node text (per UI/UX Pro Max rule)

## Color Palette (Harmonizes with Cream Canvas)

| Purpose | Fill | Stroke | Text | Usage |
|---------|------|--------|------|-------|
| **Default/Neutral** | `#ECEAE6` | `#A8A29E` | `#1C1917` | Regular nodes, steps, services |
| **Entry/Primary** | `#FEF3C7` | `#B45309` | `#1C1917` | Starting points, API gateways, key decisions |
| **Success/Done** | `#D1FAE5` | `#166534` | `#1C1917` | Completed states, correct approach, healthy |
| **Warning/Important** | `#FEF3C7` | `#92400E` | `#1C1917` | Critical steps, caution, in-progress |
| **Error/Danger** | `#FEE2E2` | `#DC2626` | `#1C1917` | Failed states, anti-patterns, avoid |
| **Info/Database** | `#DBEAFE` | `#1D4ED8` | `#1C1917` | Databases, storage, info boxes |
| **Queue/Messaging** | `#E0F2FE` | `#0891B2` | `#1C1917` | Kafka, Redis, message queues |
| **Client/User** | `#F5F5F4` | `#78716C` | `#1C1917` | External actors, user-facing |

### Node Styling Convention

```
Default:         fill:#ECEAE6,stroke:#A8A29E,color:#1C1917
Entry/Primary:   fill:#FEF3C7,stroke:#B45309,color:#1C1917
Success/Done:    fill:#D1FAE5,stroke:#166534,color:#1C1917
Warning:         fill:#FEF3C7,stroke:#92400E,color:#1C1917
Error/Avoid:     fill:#FEE2E2,stroke:#DC2626,color:#1C1917
Database:        fill:#DBEAFE,stroke:#1D4ED8,color:#1C1917
Queue/Messaging: fill:#E0F2FE,stroke:#0891B2,color:#1C1917
Client/User:     fill:#F5F5F4,stroke:#78716C,color:#1C1917
```

### Rules

1. NO emojis in flowchart node text (use descriptive labels)
2. ALL text must use `color:#1C1917` (dark) — cream canvas means dark text
3. Use light, muted fills — never heavy saturated backgrounds
4. Subgraphs/clusters use default mermaid styling (CSS handles it)
5. Maximum 2-3 accent colors per diagram (Swiss Minimalism: restrained)
6. Flow direction: LR (horizontal) for processes, TD (vertical) for hierarchies
7. Keep arrows/edges default (CSS forces dark `#1C1917`)
