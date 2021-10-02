import { mount } from '@vue/test-utils';
import Vue, { ComponentOptions } from 'vue';

function bfs(rootNode: Node) {
	const queue = [rootNode];
	const allNodes: Node[] = [];

	while (queue.length) {
		const node = queue.shift()!;
		allNodes.push(node);

		queue.push(...Array.from(node.childNodes));
	}

	return allNodes;
}

type SerializedNode = {
	nodeName: string;
	parentNode?: SerializedNode | null;
	nextSibling?: SerializedNode | null;
	firstChild?: SerializedNode | null;
	hasChildNodes: boolean;
};

export function serializeNode(
	node: Node | null,
	noReference?: boolean,
) {
	if (!node) {
		return node;
	}

	const serialized: SerializedNode = {
		nodeName: node.nodeName,
		hasChildNodes: node.hasChildNodes(),
	};

	if (!noReference) {
		serialized.parentNode = serializeNode(node.parentNode, true);
		serialized.nextSibling = serializeNode(node.nextSibling, true);
		serialized.firstChild = serializeNode(node.firstChild, true);
	}

	return serialized;
}

export function serializeDOMTree(node: Node) {
	return JSON.stringify(
		bfs(node).map(node => serializeNode(node)),
		null,
		'\t',
	);
}

// Vue replaces this node, so there's no need for cleanup
export function createMountTarget() {
	const mountTarget = document.createElement('div');
	document.body.append(mountTarget);
	return mountTarget;
}

export function createNonFragApp<V extends Vue>(fragComponent: ComponentOptions<V>) {
	type Component = ComponentOptions<V>;
	let components: Component['components'] = undefined;

	if (fragComponent.components) {
		components = {
			...fragComponent.components,
		};

		for (const componentName in components) {
			components[componentName] = createNonFragApp(components[componentName] as Component);
		}
	}

	return {
		...fragComponent,
		template: fragComponent.template?.replace(/ v-frag/g, ''),
		components,
	};
}

export function dualMount<V extends Vue>(component: ComponentOptions<V>) {
	const normal = mount(createNonFragApp(component));
	const frag = mount(component);

	return {
		frag,
		normal,
		setData(data: object) {
			return Promise.all([
				normal.setData(data),
				frag.setData(data),
			]);
		},
		expectMatchingDom() {
			expect(serializeDOMTree(frag.element)).toBe(
				serializeDOMTree(normal.element)
			);
		},
	};
}