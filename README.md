BrainCatalogue
==============

Citizen science portal for comparative brain anatomy.

The BrainCatalogue portal:
* Displays information pages for different subjects (animal species)
* Pages can contain 3D Magnetic Resonance Volumes encoded in compressed Nifti format
* Pages can also contain a 3D mesh viewer for surfaces encoded in Stanford PLY format
* Managing user log in, and user annotations
* The MRI viewer -- AtlasMaker -- supports interactive manual segmentation based on the WebSockets protocol
* AtlasMaker supports painting, erasing, filling, different pen sizes and infinite undo
* User's manual segmentations are stored in the server, and snapshots are taken periodically
* The MRI viewer can present data in 3 orthogonal planes (sagittal, coronal, axial). The current slice can be changed using a slider, +/- buttons, or the arrow keys
* On iPads the cursor is replaced by a 'precise cursor' where the position of the finger is dissociated from the position of the painting cursor
* During interactive segmentation, users can discuss using a simple 'chat' interface
* The layout of the portal is dynamically adjusted to desktop computers, tablets and phones (large, medium and small responsive layouts)
