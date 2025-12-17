import { ElevatorRoute } from '../ElevatorRoute';

describe('ElevatorRoute', () => {
	describe('Basic CRUD operations', () => {
		it('constructor should create an instance', () => {
			const route = new ElevatorRoute();
			expect(route).toBeInstanceOf(ElevatorRoute);
			expect(route.length()).toBe(0);
		});
		describe('this.requestVisit', () => {
			it('should add integer stops without duplicates', () => {
				const route = new ElevatorRoute();
				route.addRide(5);
				route.addRide(10);
				route.addRide(-3);
				route.addRide(5);
				route.addRide(10);
				expect(route.length()).toBe(3);
			});
		});

		describe('this.shouldVisit', () => {
			it('should be able to check for stops without altering the route', () => {
				const route = new ElevatorRoute();
				route.addRide(5);
				route.addRide(10);
				expect(route.length()).toBe(2);
				expect(route.shouldVisit(5)).toBe(true);
				expect(route.shouldVisit(10)).toBe(true);
				expect(route.shouldVisit(-3)).toBe(false);
				expect(route.length()).toBe(2);
			});
		});
		describe('this.visitNow', () => {
			it('should be able to make stops anywhere, altering the route', () => {
				const route = new ElevatorRoute();
				route.addRide(3);
				route.addRide(5);
				route.addRide(8);
				route.addRide(10);
				expect(route.length()).toBe(4);
				expect(route.shouldVisit(5)).toBe(true);
				expect(route.shouldVisit(10)).toBe(true);
				route.visitNow(5); //stop in middle
				expect(route.length()).toBe(3);
				expect(route.shouldVisit(5)).toBe(false); //should have changed
				expect(route.shouldVisit(10)).toBe(true); //didn't change
				route.visitNow(10); //remove last
				expect(route.length()).toBe(2);
				expect(route.shouldVisit(10)).toBe(false); //should have changed
				expect(route.shouldVisit(3)).toBe(true); //didn't change
				route.visitNow(3); //remove first
				expect(route.length()).toBe(1);
				expect(route.shouldVisit(3)).toBe(false); //should have changed
				expect(route.shouldVisit(8)).toBe(true); //didn't change
			});
		});
		describe('this.copy', () => {
			it('should create a new decoupled route with the same stops', () => {
				const route = new ElevatorRoute();
				route.addRide(3);
				route.addRide(5);
				const copy = route.copy();
				expect(copy.length()).toBe(route.length());
				expect(copy.shouldVisit(3)).toBe(true);
				expect(copy.shouldVisit(5)).toBe(true);
				expect(copy.shouldVisit(8)).toBe(false);
				copy.addRide(8);
				expect(copy.length()).toBe(route.length() + 1);
				expect(copy.shouldVisit(8)).toBe(true);
				expect(route.shouldVisit(8)).toBe(false);
				copy.visitNow(5);
				expect(copy.shouldVisit(5)).toBe(false);
				expect(route.shouldVisit(5)).toBe(true);
			});
		});
	})


	describe('Ordering and array output', () => {
		let route: ElevatorRoute;
		const stops: number[] = [7, 2, 15, -3, 10, 5];

		beforeEach(() => {
			route = new ElevatorRoute();
			for (let stop of stops) {
				route.addRide(stop);
			}
		});

		describe('implements Iterator', () => {
			it('should be iterable in insert order', () => {
				let i = 0;
				for (let stop of route) {
					expect(stop).toEqual(stops[i]);
					i++;
				}
				expect(i).toEqual(stops.length); //yes, because we do one last i++ in last loop
			});
		});

		describe('this.toArray', () => {
			it('should output array in insert order', () => {
				expect(route.toArray()).toEqual(stops);
			});
		});

		describe('order is idempotent', () => {
			it("floor doesn't move if added again", () => {
				route.addRide(7); //try to add first stop last
				expect(route.toArray()).toEqual(stops);
			});
		});

		describe('this.first', () => {
			it('should get first value', () => {
				expect(route.first()).toBe(7);
			});
		});

		describe('this.last', () => {
			it('should get last value', () => {
				expect(route.last()).toBe(5);
			});
		});
	});
});

