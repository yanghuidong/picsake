import { setIcon } from 'obsidian';
import { onMount } from 'solid-js';

export { IconButton };

function IconButton(props: {
	name: 'undo-2'
	onClick: (evt: MouseEvent) => void
}) {
	let iconRef!: HTMLDivElement;

	onMount(() => {
		setIcon(iconRef, props.name);
	});

	return (
		<div ref={iconRef}
			onClick={(evt) => props.onClick(evt)}
		/>
	);
}