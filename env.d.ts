declare module 'inline-worker:*' {
	type WorkerFactory = new (options?: WorkerOptions) => Worker;
	const WorkerCtor: WorkerFactory;
	export default WorkerCtor;
}
