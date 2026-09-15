import { Pass } from './Pass.js';

class MaskPass extends Pass {
	constructor(scene, camera) {
		super();
		this.scene = scene;
		this.camera = camera;
		this.clear = true;
		this.needsSwap = false;
		this.inverse = false;
	}

	render(renderer, writeBuffer, readBuffer) {
		const context = renderer.getContext();
		const state = renderer.state;
		state.buffers.stencil.setTest(true);
		state.buffers.stencil.setOp(context.REPLACE, context.REPLACE, context.REPLACE);
		state.buffers.stencil.setFunc(context.ALWAYS, this.inverse ? 0 : 1, 0xffffffff);
		state.buffers.stencil.setClear(this.inverse ? 1 : 0);
		state.buffers.stencil.setLocked(true);
		renderer.setRenderTarget(readBuffer);
		if (this.clear) renderer.clear();
		renderer.render(this.scene, this.camera);
		renderer.setRenderTarget(writeBuffer);
		if (this.clear) renderer.clear();
		renderer.render(this.scene, this.camera);
		state.buffers.stencil.setLocked(false);
		state.buffers.stencil.setFunc(context.EQUAL, 1, 0xffffffff);
		state.buffers.stencil.setOp(context.KEEP, context.KEEP, context.KEEP);
		state.buffers.stencil.setLocked(true);
	}
}

class ClearMaskPass extends Pass {
	constructor() {
		super();
		this.needsSwap = false;
	}

	render(renderer) {
		renderer.state.buffers.stencil.setLocked(false);
		renderer.state.buffers.stencil.setTest(false);
	}
}

export { MaskPass, ClearMaskPass };
