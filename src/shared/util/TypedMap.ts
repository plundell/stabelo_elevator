type KeyValueTypes<K, V> = { key: K, value: V }

//Doesn't work for primitive key types
// type ResolveValueFromKey<M extends KeyValueTypes<unknown, unknown>, K> =
// 	M extends { key: K; value: infer V } ? V : never

type ResolveValueFromKey<M extends KeyValueTypes<unknown, unknown>, K> =
	M extends KeyValueTypes<infer MK, infer MV>
	? K extends MK
	? MV
	: never
	: never;

export class TypedMap<M extends KeyValueTypes<unknown, unknown>> extends Map<M["key"], M["value"]> {

	override get<K extends M["key"]>(key: K): ResolveValueFromKey<M, K> | undefined {
		return super.get(key) as ResolveValueFromKey<M, K> | undefined;
	}

	override set<K extends M["key"], V extends ResolveValueFromKey<M, K>>(key: K, value: V): this {
		return super.set(key, value);
	}

}

// interface MyInterface {
// 	name: string
// 	age: number
// }

// type MyTuple = [number, number]


// type MyTypeMap =
// 	| { key: Date, value: string }
// 	| { key: MyTuple, value: MyInterface }
// 	| { key: Date, value: number }
// 	| { key: number, value: string }



// const typedMap = new TypedMap<MyTypeMap>();
// typedMap.set(new Date(), "hello");
// typedMap.set([1, 2], { name: "John", age: 30 });
// typedMap.set([1, 2], new Date()); //error which is correct, because we're mapping the wrong key type to date value type
// typedMap.set(new Date(), 55); //works
// typedMap.set(2, "world"); //works
// typedMap.set("hello", "world"); //doesn't work which is correct



// const a = typedMap.get(new Date()); //works
// const b = typedMap.get([1, 2]); //works
// const c = typedMap.get(1); //error which is correct
// const d = typedMap.get(new Date()); //works
// const e = typedMap.get([1, 2]); //works
// const f = typedMap.get(1); //works