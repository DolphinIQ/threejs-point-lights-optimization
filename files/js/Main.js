
// Global Variables
let canvas = document.getElementsByClassName("three-canvas")[0];
let parent = document.getElementsByClassName("canv-box")[0];

import * as THREE from 'three';
import { OrbitControls } from 'orbit-controls';

// UTILITY
import Stats from './../../node_modules/three/examples/jsm/libs/stats.module.js';
import { GPUStatsPanel } from './../../node_modules/three/examples/jsm/utils/GPUStatsPanel.js';
import { GUI } from './../../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';

let camera, controls, scene, renderer;
let gui, stats, gpuPanel;
let pointLights = [];
const POSITION_RANGE = 1000;
const settings = {
    profiling: {
        gpu: true
    }
};

init();

function init() {

	console.log( 'THREE.ShaderChunk:', THREE.ShaderChunk );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x222222 );
	// scene.fog = new THREE.FogExp2( 0xcccccc, 0.001 ); // 0.002
	scene.fog = new THREE.FogExp2( 0x222222, 0.001 ); // 0.002

	renderer = new THREE.WebGLRenderer( { canvas: canvas, antialias: true, powerPreference: "high-performance" } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( parent.offsetWidth , parent.offsetHeight );
	// document.body.appendChild( renderer.domElement );

	camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.set( 400, 200, 0 );

	// controls
	controls = new OrbitControls( camera, renderer.domElement );
	controls.listenToKeyEvents( window ); // optional
	//controls.addEventListener( 'change', render ); // call this only in static scenes (i.e., if there is no animation loop)
	controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
	controls.dampingFactor = 0.05;
	controls.screenSpacePanning = false;
	controls.minDistance = 100;
	controls.maxDistance = 2000;
	controls.maxPolarAngle = Math.PI / 2;

	//Stats
	stats = new Stats();
	document.body.appendChild( stats.dom );
    gpuPanel = new GPUStatsPanel( renderer.getContext() );
    stats.addPanel( gpuPanel );
    stats.showPanel( 3 ); // 0 fps, 1 CPU, 2 memory, 3 gpu

	//GUI
	gui = new GUI();
	// gui.add(object, property, [min], [max], [step])
    gui.add( settings.profiling, "gpu" ).name("GPU profiling");

    // Meshes
    addMeshes();

	// Lights
	const numOfPointLights = 50;
	addPointLights( numOfPointLights );

    // Editing lights chunks
	editTHREE();
    
    animate();

	window.addEventListener( 'resize', onWindowResize );
}

function addMeshes() {

    const geometry = new THREE.CylinderGeometry( 0, 10, 30, 4, 1 );
	const material = new THREE.MeshPhongMaterial( { color: 0xffffff, flatShading: true } );

	const SCALE_RANGE = 10;
	for ( let i = 0; i < 700; i ++ ) {
		const mesh = new THREE.Mesh( geometry, material );
		mesh.position.x = Math.random() * POSITION_RANGE * 2 - POSITION_RANGE;
		mesh.position.y = 0;
		mesh.position.z = Math.random() * POSITION_RANGE * 2 - POSITION_RANGE;
		mesh.scale.set( 1 + Math.random() * SCALE_RANGE, 1 + Math.random() * SCALE_RANGE, 1 + Math.random() * SCALE_RANGE );
		mesh.updateMatrix();
		mesh.matrixAutoUpdate = false;
		scene.add( mesh );

		// if( i === 0 ) console.log( mesh.material );
	}

	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry( 2500, 2500 ),
		material
	);
	floor.geometry.rotateX( -90 * Math.PI/180 );
	scene.add( floor );
}

/**
 * function renderScene( currentRenderList, scene, camera, viewport ) {
 * currentRenderState.setupLightsView( camera );
 * 
 * function setupLightsView( camera ) {
 * lights.setupView( lightsArray, camera );
 * 
 * setting global lights uniforms
 */

function editTHREE() {
	
	// THREE.ShaderChunk.lights_fragment_begin = THREE.ShaderChunk.lights_fragment_begin.replace(
		// `RE_Direct( directLight, geometry, material, reflectedLight );`,
		// `if ( directLight.visible ) {
		// 	RE_Direct( directLight, geometry, material, reflectedLight );
		// }`
	// );

	THREE.ShaderChunk.lights_fragment_begin = /* glsl */`
	
	GeometricContext geometry;
	
	geometry.position = - vViewPosition;
	geometry.normal = normal;
	geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
	
	#ifdef USE_CLEARCOAT
	
		geometry.clearcoatNormal = clearcoatNormal;
	
	#endif
	
	IncidentLight directLight;
	
	#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	
		PointLight pointLight;
		#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
		PointLightShadow pointLightShadow;
		#endif
	
        // STANDARD LIGHTS LOOP
		// #pragma unroll_loop_start
		// for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
	
		// 	pointLight = pointLights[ i ];
	
		// 	getPointLightInfo( pointLight, geometry, directLight );
	
		// 	#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		// 	pointLightShadow = pointLightShadows[ i ];
		// 	directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		// 	#endif
	
		// 	RE_Direct( directLight, geometry, material, reflectedLight );
	
		// }
		// #pragma unroll_loop_end

        // MODIFIED LOOP WITH BRANCHING AND EARLY continue
		for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
	
			pointLight = pointLights[ i ];
	
			getPointLightInfo( pointLight, geometry, directLight );

			if ( !directLight.visible ) { continue; }
	
			#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
			pointLightShadow = pointLightShadows[ i ];
			directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
			#endif
	
			RE_Direct( directLight, geometry, material, reflectedLight );
	
		}
	
	#endif
	
	#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	
		SpotLight spotLight;
		#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
		SpotLightShadow spotLightShadow;
		#endif
	
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
	
			spotLight = spotLights[ i ];
	
			getSpotLightInfo( spotLight, geometry, directLight );
	
			#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			spotLightShadow = spotLightShadows[ i ];
			directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;
			#endif
	
			RE_Direct( directLight, geometry, material, reflectedLight );
	
		}
		#pragma unroll_loop_end
	
	#endif
	
	#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	
		DirectionalLight directionalLight;
		#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
		DirectionalLightShadow directionalLightShadow;
		#endif
	
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
	
			directionalLight = directionalLights[ i ];
	
			getDirectionalLightInfo( directionalLight, geometry, directLight );
	
			#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
			directionalLightShadow = directionalLightShadows[ i ];
			directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
			#endif
	
			RE_Direct( directLight, geometry, material, reflectedLight );
	
		}
		#pragma unroll_loop_end
	
	#endif
	
	#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	
		RectAreaLight rectAreaLight;
	
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
	
			rectAreaLight = rectAreaLights[ i ];
			RE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );
	
		}
		#pragma unroll_loop_end
	
	#endif
	
	#if defined( RE_IndirectDiffuse )
	
		vec3 iblIrradiance = vec3( 0.0 );
	
		vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	
		irradiance += getLightProbeIrradiance( lightProbe, geometry.normal );
	
		#if ( NUM_HEMI_LIGHTS > 0 )
	
			#pragma unroll_loop_start
			for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
	
				irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry.normal );
	
			}
			#pragma unroll_loop_end
	
		#endif
	
	#endif
	
	#if defined( RE_IndirectSpecular )
	
		vec3 radiance = vec3( 0.0 );
		vec3 clearcoatRadiance = vec3( 0.0 );
	
	#endif
	`

	THREE.ShaderChunk.lights_pars_begin = THREE.ShaderChunk.lights_pars_begin.replace(
		// `light.color = pointLight.color;
		// light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		// light.visible = ( light.color != vec3( 0.0 ) );`,
		`light.color = pointLight.color;`,

		`
		light.color = pointLight.color * step( lightDistance, pointLight.distance );
		`
		// `
		// if ( lightDistance > pointLight.distance ) {
		// 	light.color = vec3( 0.0, 0.0, 0.0 );
		// 	light.visible = false;
		// } else {
		// 	light.color = pointLight.color;
		// 	light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		// 	light.visible = ( light.color != vec3( 0.0 ) );
		// }
		// `
	);
}

function addPointLights( number ) {

	const helperGeometry = new THREE.SphereGeometry( 3, 8, 8 );

	class SphereHelper extends THREE.Mesh {
		constructor( color ) {
			const helperMaterial = new THREE.MeshBasicMaterial({ color });
			super( helperGeometry, helperMaterial );
		}
	}

	for ( let i = 0; i < number; i++ ) {

		const color = Math.random() * 0xffffff;
		const p_light =  new THREE.PointLight( color, 1, 100 );
		const helper = new SphereHelper( color );
		p_light.add( helper );
		pointLights.push( p_light );

		p_light.position.x = Math.random() * POSITION_RANGE - POSITION_RANGE / 2;
		p_light.position.y = Math.random() * 100 + 20;
		p_light.position.z = Math.random() * POSITION_RANGE - POSITION_RANGE / 2;

		p_light.updateMatrix();
		p_light.matrixAutoUpdate = false;
		helper.matrixAutoUpdate = false;

		scene.add( p_light );
	}

	const ambientLight = new THREE.AmbientLight( 0x222222 );
	scene.add( ambientLight );
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
	
	stats.begin();
	requestAnimationFrame( animate );

	controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

    if ( settings.profiling.gpu ) gpuPanel.startQuery();
    renderer.render( scene, camera );
    if ( settings.profiling.gpu ) gpuPanel.endQuery();
	
	stats.end();
}