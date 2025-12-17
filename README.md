# Stabelo Elevator

An elevator controller system written in TypeScript with both CLI and HTTP API interfaces.

> **Note:** The presentation layer (CLI/HTTP interfaces) is AI-generated bootstrap code and is not yet complete. The core domain logic for elevator control is functional and tested.

## Overview

This project implements an intelligent elevator control system that can manage multiple elevators with configurable travel strategies. The system uses Domain-Driven Design principles and includes:

- **Smart elevator routing** with pluggable strategies
- **Multi-elevator coordination** to optimize passenger wait times
- **Event-driven architecture** for real-time state updates
- **Configurable behavior** (travel times, door times, floor ranges, etc.)
- **Comprehensive test coverage** for core domain logic

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn

## Installation

```bash
npm install
```

## Development

**Note:** Running `npm run dev` will start the application, but nothing visible happens yet as the elevator service integration is still in progress.

**CLI Mode**:
```bash
npm run dev --cli
```

**HTTP Server** :
TODO
```bash
npm run dev --http
```

The HTTP server runs on `http://localhost:3000` (or the port specified in your `.env` file).

## Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

## Testing

**Tests are currently working!** Run them with:

```bash
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
```

## Project Structure

```
src/
├── domain/                      # Core business logic
│   ├── elevator/                # Elevator entity and I/O
│   │   ├── Elevator.ts          # Main elevator class
│   │   ├── ElevatorIO.ts        # Elevator state machine & I/O simulation
│   │   └── types.ts             # Elevator state types
│   ├── route/                   # Route management //TODO: Bad naming?
│   │   ├── ElevatorRoute.ts     # Route data structure
│   │   ├── Floors.ts            # Floor validation
│   │   └── RouteItem.ts         # Individual route items
│   ├── strategies/              # Travel strategies
│   │   ├── Strategy.ts          # Abstract strategy base
│   │   ├── InsertOrder.ts       # Insert-order strategy
│   │   └── StopEnRoute.ts       # Stop-en-route strategy
│   ├── services/                # Domain services
│   │   └── ElevatorService.ts   # Multi-elevator coordination
│   └── errors/                  # Domain-specific errors
├── app/                         # Application layer
│   ├── app.ts                   # Main application class
│   └── health/                  # Health check services
├── api/                         # Presentation layer (WIP)
│   ├── cli/                     # CLI interface (bootstrap)
│   └── http/                    # HTTP API (bootstrap)
├── infra/                       # Infrastructure
│   ├── logger/                  # Logging utilities
│   └── events/                  # Typed event emitter
├── shared/                      # Shared utilities
│   ├── errors/                  # Base error classes
│   ├── types/                   # Type helpers
│   └── util/                    # Utility functions
└── index.ts                     # Main entry point
```

## Architecture

### Domain-Driven Design

The project follows **Domain-Driven Design (DDD)** principles:

- **Domain Layer**: Contains the core elevator logic, routing algorithms, and travel strategies
- **Application Layer**: Orchestrates the application lifecycle and health monitoring
- **Presentation Layer**: Provides CLI and HTTP interfaces (currently bootstrap/WIP)
- **Infrastructure Layer**: Logging, events, and other cross-cutting concerns

### Key Concepts

#### Elevator
A single elevator unit that combines:
- **I/O simulation** - simulates physical elevator movement and door operations
- **Route management** - maintains an ordered list of floors to visit
- **Travel strategy** - determines optimal floor visit order

#### ElevatorService
Coordinates multiple elevators by:
- Selecting the best elevator for each ride request
- Estimating pickup/dropoff times
- Balancing load across elevators

#### Strategies
Pluggable algorithms that determine elevator behavior:
- **InsertOrder**: Visits floors in the order they were requested
- **StopEnRoute**: Optimizes by stopping at floors along the way

### Configuration

The system is highly configurable via `AppOptions` (see `src/options.ts`):

```typescript
{
  travelTimePerFloor: 1000,    // ms between floors
  doorOpenTime: 1000,          // ms doors stay open
  estimationLimit: 10000,      // max simulation time
  minFloor: 0,                 // lowest floor
  maxFloor: 20,                // highest floor
  nrOfElevators: 5,            // number of elevators
  initialFloor: 0,             // starting floor
  useFreeFirst: true           // prefer idle elevators
}
```

## Environment Variables

Create a `.env` file in the root directory (see `example.env`):

```
PORT=3000
NODE_ENV=development
```

## Available Scripts

- `npm run dev` - Start app (requires --cli or --http flags; currently nothing happens yet)
- `npm run dev:cli` - Start CLI in development mode with hot-reload
- `npm run dev:http` - Start HTTP server in development mode with hot-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled application (requires --cli or --http flags)
- `npm test` - Run tests ✅ (currently working!)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run type-check` - Type check without emitting files

## Current Status

✅ **Complete:**
- Core elevator domain logic
- Route management and floor validation
- Multiple travel strategies with tests
- Event-driven state machine
- Multi-elevator coordination
- Comprehensive unit tests

🚧 **In Progress (Bootstrap/AI-generated):**
- CLI interface integration
- HTTP API endpoints
- Full application integration
- End-to-end functionality

## License

ISC