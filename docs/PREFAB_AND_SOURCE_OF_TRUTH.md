# Prefab And Source-Of-Truth Notes

This document records the intended editor model for assets, scene objects, groups, prefabs, and clone/instance behavior.

## Core Rule

There must always be one geometry source of truth:

- `Asset` is the only source of truth for model geometry and materials.

Everything else is derived from assets.

## Main Concepts

### Asset

An `Asset` is an original model from the asset library.

It is responsible for:

- geometry
- materials
- textures
- the original loaded template used for placement

An asset is never mutated into scene-specific truth.

### Scene Object

A `Scene Object` is a placed item in the current scene.

It should store:

- `assetId`
- transform
- name
- parent/group relationship
- hidden/locked state
- placement kind: `clone` or `instance`

A scene object does not own geometry truth. It always comes from the original asset source.

### Group

A `Group` is a scene-only hierarchy container.

It is responsible for:

- organizing objects in the current scene
- holding object/group hierarchy
- group-level hidden/locked state
- transform of the grouped arrangement

A group is not reusable content by itself unless explicitly saved as a prefab.

### Scene

A `Scene` is the full currently open working document.

It contains:

- scene objects
- groups
- hierarchy
- scene settings and metadata

### Prefab

A `Prefab` is a reusable saved arrangement of scene items.

A prefab should not store baked Babylon runtime geometry as its own truth.

A prefab should store:

- prefab id
- prefab name
- created/updated timestamps
- group hierarchy
- object entries
- relative transforms
- object names
- hidden/locked state
- placement kind
- `assetId` references

When inserted, a prefab creates new scene objects and groups by instantiating from the original asset sources.

## Source Of Truth Rules

### Geometry Source Of Truth

- Assets own geometry.
- Scene objects reference assets.
- Groups do not own geometry.
- Prefabs do not own geometry.

### Clone And Instance

`Clone` and `Instance` are placement modes, not separate model sources.

Both must be created from the same original asset template:

- `Instance` uses the original asset source through an instancing path
- `Clone` uses the original asset source through a cloning path

The asset remains the single point of truth in both cases.

### Prefab Rule

A prefab is a reusable recipe, not a second asset library.

That means:

- prefab content references `assetId`
- prefab insertion recreates scene objects from assets
- prefab editing changes arrangement data, not source model data

## Naming Rules

For user-facing terminology, prefer:

- `Asset`
- `Object`
- `Group`
- `Scene`
- `Prefab`

Avoid using:

- `Template` for prefabs
  Reason: the project already has internal asset template/runtime concepts
- `Collection`
  Reason: too vague and organizational
- `Module`
  Reason: clashes with code meaning
- `Preset`
  Reason: sounds like settings, not reusable geometry hierarchy

## Recommended User-Facing Actions

### Scene Tree

- `Create Empty Group`
- `Group Selected`
- `Save Group As Prefab`

### Prefab Library

- `Insert Prefab`
- `Rename Prefab`
- `Delete Prefab`

Later:

- `Update From Selected Group`

## Recommended First Prefab Scope

The first prefab implementation should be intentionally narrow:

- save groups only
- store prefabs locally first
- show prefabs in a separate tab from the Scene Tree
- insert prefab back into the current scene
- no live prefab linkage yet
- no prefab thumbnails required for v1

## Separation Of Responsibilities

### JSON Scene Export

JSON remains the editor-native format.

It should preserve:

- scene hierarchy
- scene metadata
- editor settings/state relevant to the document

### GLB/GLTF Export

GLB/GLTF exports represent the current baked scene result.

They are export targets, not the editor source of truth.

Inside the editor, source of truth remains:

- assets for geometry
- scene objects for placement
- groups for hierarchy
- prefabs for reusable arrangement definitions

## Preferred Internal Model

If codified later in TypeScript, the intended architecture is:

- `AssetDefinition`: source asset
- `SceneObject`: placed asset reference
- `SceneGroup`: hierarchy container
- `PrefabDefinition`: reusable arrangement referencing assets

## Summary

The key architectural sentence is:

> A prefab is a structured reusable arrangement of scene items that references assets by id; when inserted, each object is created from the original asset source using its stored placement mode.

That keeps:

- one geometry source of truth
- clean separation between scene editing and reusable content
- a stable foundation for future prefab features
