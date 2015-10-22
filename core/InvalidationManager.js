(function () {
    
    
    var UIComponentGlobals = {};
UIComponentGlobals.callLaterSuspendCount = 0;

var InvalidationManager = function () {

    
    
    //--------------------------------------------------------------------------
    //
    //  Private
    //
    //--------------------------------------------------------------------------
    
    //--------------------------------------------------------------------------
    //  Variables
    //--------------------------------------------------------------------------

    /**
     *  @private
     *  A queue of objects that need to dispatch updateComplete events
     *  when invalidation processing is complete
     */
    var updateCompleteQueue = new PriorityQueue();

    /**
     *  @private
     *  A queue of objects to be processed during the first phase
     *  of invalidation processing, when an ILayoutManagerClient  has
     *  its validateProperties() method called (which in a UIComponent
     *  calls commitProperties()).
     *  Objects are added to this queue by invalidateProperties()
     *  and removed by validateProperties().
     */
    var invalidatePropertiesQueue = new PriorityQueue();

    /**
     *  @private
     *  A flag indicating whether there are objects
     *  in the invalidatePropertiesQueue.
     *  It is set true by invalidateProperties()
     *  and set false by validateProperties().
     */
    var invalidatePropertiesFlag = false;

    // flag when in validateClient to check the properties queue again
    var invalidateClientPropertiesFlag = false;

    /**
     *  @private
     *  A queue of objects to be processed during the second phase
     *  of invalidation processing, when an ILayoutManagerClient  has
     *  its validateSize() method called (which in a UIComponent
     *  calls measure()).
     *  Objects are added to this queue by invalidateSize().
     *  and removed by validateSize().
     */
    var invalidateSizeQueue = new PriorityQueue();

    /**
     *  @private
     *  A flag indicating whether there are objects
     *  in the invalidateSizeQueue.
     *  It is set true by invalidateSize()
     *  and set false by validateSize().
     */
    var invalidateSizeFlag = false;

    // flag when in validateClient to check the size queue again
    var invalidateClientSizeFlag = false;

    /**
     *  @private
     *  A queue of objects to be processed during the third phase
     *  of invalidation processing, when an ILayoutManagerClient  has
     *  its validateView() method called (which in a
     *  UIComponent calls updateView()).
     *  Objects are added to this queue by invalidateView()
     *  and removed by validateView().
     */
    var invalidateViewQueue = new PriorityQueue();

    /**
     *  @private
     *  A flag indicating whether there are objects
     *  in the invalidateViewQueue.
     *  It is set true by invalidateView()
     *  and set false by validateView().
     */
    var invalidateViewFlag = false;

    /**
     *  @private
     */
    var waitedAFrame = false;

    /**
     *  @private
     */
    var listenersAttached = false;

    /**
     *  @private
     */
    var originalFrameRate = NaN;

    /**
     *  @private
     *  used in validateClient to quickly estimate whether we have to
     *  search the queues again
     */
    var targetLevel = 1000000;

    /**
     *  @private
     *  the top level systemmanager
     */
    var systemManager;

	/**
	 *  @private
	 *  the current object being validated
	 *  it could be wrong if the validating object calls validateNow on something.
	 */
	var currentObject;
	
    
    //--------------------------------------------------------------------------
    //
    //  Properties
    //
    //--------------------------------------------------------------------------

    //----------------------------------
    //  usePhasedInstantiation
    //----------------------------------

    /**
     *  @private
     *  Storage for the usePhasedInstantiation property.
     */
    var usePhasedInstantiation = false;
    
    var _usingBridge = -1;

    
    //--------------------------------------------------------------------------
    //
    //  Public
    //
    //--------------------------------------------------------------------------
    
    return {
        /**
         *  A flag that indicates whether the LayoutManager allows screen updates
         *  between phases.
         *  If <code>true</code>, measurement and layout are done in phases, one phase
         *  per screen update.
         *  All components have their <code>validateProperties()</code> 
         *  and <code>commitProperties()</code> methods 
         *  called until all their properties are validated.  
         *  The screen will then be updated.  
         * 
         *  <p>Then all components will have their <code>validateSize()</code> 
         *  and <code>measure()</code>
         *  methods called until all components have been measured, then the screen
         *  will be updated again.  </p>
         *
         *  <p>Finally, all components will have their
         *  <code>validateView()</code> and 
         *  <code>updateView()</code> methods called until all components
         *  have been validated, and the screen will be updated again.  
         *  If in the validation of one phase, an earlier phase gets invalidated, 
         *  the LayoutManager starts over.  
         *  This is more efficient when large numbers of components
         *  are being created an initialized.  The framework is responsible for setting
         *  this property.</p>
         *
         *  <p>If <code>false</code>, all three phases are completed before the screen is updated.</p>
         *  
         *  @langversion 3.0
         *  @playerversion Flash 9
         *  @playerversion AIR 1.1
         *  @productversion Flex 3
         */
        getUsePhasedInstantiation: function () {
            return usePhasedInstantiation;
        },
    
        /**
         *  @private
         */
        setUsePhasedInstantiation: function (value) {
            if (usePhasedInstantiation !== value) {
                usePhasedInstantiation = value;
    
                // While we're doing phased instantiation, temporarily increase
                // the frame rate.  That will cause the enterFrame and render
                // events to fire more promptly, which improves performance.
                try {
                    // can't use FlexGlobals here.  It may not be setup yet
    //                var stage:Stage = systemManager.stage;
    //                if (stage)
    //                {
    //                    if (value)
    //                    {
    //                        originalFrameRate = stage.frameRate;
    //                        stage.frameRate = 1000;
    //                    }
    //                    else
    //                    {
    //                        stage.frameRate = originalFrameRate;
    //                    }
    //                }
                } catch (e) {
                    // trace("ignoring security error changing the framerate " + e);
                }
            }
        },
//    
//        //----------------------------------
//        //  debugHelper
//        //----------------------------------
//        
//        /* 
//        // LAYOUT_DEBUG
//        import mx.managers.layoutClasses.LayoutDebugHelper;
//        static var _layoutDebugHelper:LayoutDebugHelper;
//        
//        public static function get debugHelper():LayoutDebugHelper
//        {
//            if (!_layoutDebugHelper)
//            {
//                _layoutDebugHelper = new LayoutDebugHelper();
//                _layoutDebugHelper.mouseEnabled = false;
//                var sm:ISystemManager = SystemManagerGlobals.topLevelSystemManagers[0]
//                sm.addChild(_layoutDebugHelper);
//            }
//            return _layoutDebugHelper;
//        } */
//    
        /**
         *  Adds an object to the list of components that want their 
         *  <code>validateProperties()</code> method called.
         *  A component should call this method when a property changes.  
         *  Typically, a property setter method
         *  stores a the new value in a temporary variable and calls 
         *  the <code>invalidateProperties()</code> method 
         *  so that its <code>validateProperties()</code> 
         *  and <code>commitProperties()</code> methods are called
         *  later, when the new value will actually be applied to the component and/or
         *  its children.  The advantage of this strategy is that often, more than one
         *  property is changed at a time and the properties may interact with each
         *  other, or repeat some code as they are applied, or need to be applied in
         *  a specific order.  This strategy allows the most efficient method of
         *  applying new property values.
         *
         *  @param obj The object whose property changed.
         *  
         *  @langversion 3.0
         *  @playerversion Flash 9
         *  @playerversion AIR 1.1
         *  @productversion Flex 3
         */
        invalidateProperties: function (obj) {
            if (!invalidatePropertiesFlag && window) {
                invalidatePropertiesFlag = true;
    
                if (!listenersAttached) {
                    this.attachListeners();
                }
            }
    
            // trace("LayoutManager adding " + Object(obj) + " to invalidatePropertiesQueue");
    
            if (targetLevel <= obj.nestLevel) {
                invalidateClientPropertiesFlag = true;
            }
    
            invalidatePropertiesQueue.addObject(obj, obj.nestLevel);
    
            // trace("LayoutManager added " + Object(obj) + " to invalidatePropertiesQueue");
        },
    
        /**
         *  Adds an object to the list of components that want their 
         *  <code>validateSize()</code> method called.
         *  Called when an object's size changes.
         *
         *  <p>An object's size can change for two reasons:</p>
         *
         *  <ol>
         *    <li>The content of the object changes. For example, the size of a
         *    button changes when its <code>label</code> is changed.</li>
         *    <li>A script explicitly changes one of the following properties:
         *    <code>minWidth</code>, <code>minHeight</code>,
         *    <code>explicitWidth</code>, <code>explicitHeight</code>,
         *    <code>maxWidth</code>, or <code>maxHeight</code>.</li>
         *  </ol>
         *
         *  <p>When the first condition occurs, it's necessary to recalculate
         *  the measurements for the object.
         *  When the second occurs, it's not necessary to recalculate the
         *  measurements because the new size of the object is known.
         *  However, it's necessary to remeasure and relayout the object's
         *  parent.</p>
         *
         *  @param obj The object whose size changed.
         *  
         *  @langversion 3.0
         *  @playerversion Flash 9
         *  @playerversion AIR 1.1
         *  @productversion Flex 3
         */
        invalidateSize: function (obj) {
//            console.log( "invalidateSize", obj );
            if (!invalidateSizeFlag && window) {
                invalidateSizeFlag = true;
    
                if (!listenersAttached) {
                    attachListeners();
                }
            }
    
            // trace("LayoutManager adding " + Object(obj) + " to invalidateSizeQueue");
    
            if (targetLevel <= obj.nestLevel) {
                invalidateClientSizeFlag = true;
            }
            
            invalidateSizeQueue.addObject(obj, obj.nestLevel);
    
            // trace("LayoutManager added " + Object(obj) + " to invalidateSizeQueue");
        },
    
        /**
         *  Called when a component changes in some way that its layout and/or visuals
         *  need to be changed.
         *  In that case, it is necessary to run the component's layout algorithm,
         *  even if the component's size hasn't changed.  For example, when a new child component
         *  is added, or a style property changes or the component has been given
         *  a new size by its parent.
         *
         *  @param obj The object that changed.
         *  
         *  @langversion 3.0
         *  @playerversion Flash 9
         *  @playerversion AIR 1.1
         *  @productversion Flex 3
         */
        invalidateView: function (obj) {
//            console.log( "invalidateView", obj );
            if (!invalidateViewFlag && window) {
                invalidateViewFlag = true;
    
                if (!listenersAttached) {
                    this.attachListeners();
                }
            } else if (!invalidateViewFlag && !window) {
                // trace("systemManager is null");
            }
    
            // trace("LayoutManager adding " + Object(obj) + " to invalidateViewQueue");
    
            invalidateViewQueue.addObject(obj, obj.nestLevel);
    
            // trace("LayoutManager added " + Object(obj) + " to invalidateViewQueue");
        },

        /**
         *  Validates all components whose properties have changed and have called
         *  the <code>invalidateProperties()</code> method.  
         *  It calls the <code>validateProperties()</code> method on those components
         *  and will call <code>validateProperties()</code> on any other components that are 
         *  invalidated while validating other components.
         *  
         *  @langversion 3.0
         *  @playerversion Flash 9
         *  @playerversion AIR 1.1
         *  @productversion Flex 3
         */
        validateProperties: function () {
            // trace("--- LayoutManager: validateProperties --->");
    //        CONFIG::performanceInstrumentation
    //        {
    //            var perfUtil:PerfUtil = PerfUtil.getInstance();
    //            perfUtil.markTime("validateProperties().start");
    //        }
    
            // Keep traversing the invalidatePropertiesQueue until we've reached the end.
            // More elements may get added to the queue while we're in this loop, or a
            // a recursive call to this function may remove elements from the queue while
            // we're in this loop.
            var obj = invalidatePropertiesQueue.removeSmallest();
            while (obj) {
                // trace("LayoutManager calling validateProperties() on " + Object(obj) + " " + DisplayObject(obj).width + " " + DisplayObject(obj).height);
    
    //            CONFIG::performanceInstrumentation
    //            {
    //                var token:int = perfUtil.markStart();
    //            }
                
                if (obj.nestLevel) {
                    currentObject = obj;
                    obj.validateProperties();
                    if (!obj.updateCompletePendingFlag) {
                        updateCompleteQueue.addObject(obj, obj.nestLevel);
                        obj.updateCompletePendingFlag = true;
                    }
                    
                }
    //            CONFIG::performanceInstrumentation
    //            {
    //                perfUtil.markEnd(".validateProperties()", token, 2 /*tolerance*/, obj);
    //            }
    
                // Once we start, don't stop.
                obj = invalidatePropertiesQueue.removeSmallest();
            }
    
            if (invalidatePropertiesQueue.isEmpty()) {
                // trace("Properties Queue is empty");
    
                invalidatePropertiesFlag = false;
            }
    
            // trace("<--- LayoutManager: validateProperties ---");
    //        CONFIG::performanceInstrumentation
    //        {
    //            perfUtil.markTime("validateProperties().end");
    //        }
        },
    
        /**
         *  Validates all components whose properties have changed and have called
         *  the <code>invalidateSize()</code> method.  
         *  It calls the <code>validateSize()</code> method on those components
         *  and will call the <code>validateSize()</code> method 
         *  on any other components that are 
         *  invalidated while validating other components.  
         *  The </code>validateSize()</code> method  starts with
         *  the most deeply nested child in the tree of display objects
         *  
         *  @langversion 3.0
         *  @playerversion Flash 9
         *  @playerversion AIR 1.1
         *  @productversion Flex 3
         */
        validateSize: function () {
            // trace("--- LayoutManager: validateSize --->");
    //        CONFIG::performanceInstrumentation
    //        {
    //            var perfUtil:PerfUtil = PerfUtil.getInstance();
    //            perfUtil.markTime("validateSize().start");
    //        }
    
            var obj = invalidateSizeQueue.removeLargest();
            while (obj) {
                // trace("LayoutManager calling validateSize() on " + Object(obj));
    //            CONFIG::performanceInstrumentation
    //            {
    //                var objToken:int;
    //                if (PerfUtil.detailedSampling)
    //                    objToken = perfUtil.markStart();
    //            }
                
                if (obj.nestLevel) {
                    currentObject = obj;
                    obj.validateSize();
                    if (!obj.updateCompletePendingFlag) {
                        updateCompleteQueue.addObject(obj, obj.nestLevel);
                        obj.updateCompletePendingFlag = true;
                    }
                }
    
    //            CONFIG::performanceInstrumentation
    //            {
    //                if (PerfUtil.detailedSampling)
    //                    perfUtil.markEnd(".validateSize()", objToken, 2 /*tolerance*/, obj);
    //            }
                // trace("LayoutManager validateSize: " + Object(obj) + " " + IFlexDisplayObject(obj).measuredWidth + " " + IFlexDisplayObject(obj).measuredHeight);
    
                obj = invalidateSizeQueue.removeLargest();
            }
    
            if (invalidateSizeQueue.isEmpty()) {
                // trace("Measurement Queue is empty");
    
                invalidateSizeFlag = false;
            }
    
    //        CONFIG::performanceInstrumentation
    //        {
    //            perfUtil.markTime("validateSize().end");
    //        }
            // trace("<--- LayoutManager: validateSize ---");
        },
    
        /**
         *  Validates all components whose properties have changed and have called
         *  the <code>invalidateView()</code> method.  
         *  It calls <code>validateView()</code> method on those components
         *  and will call the <code>validateView()</code> method 
         *  on any other components that are 
         *  invalidated while validating other components.  
         *  The <code>validateView()</code> method starts with
         *  the least deeply nested child in the tree of display objects
         *
         *  
         *  @langversion 3.0
         *  @playerversion Flash 9
         *  @playerversion AIR 1.1
         *  @productversion Flex 3
         */
        validateView: function () {
    
            var obj = invalidateViewQueue.removeSmallest();
            while (obj) {
                
                if (obj.nestLevel) {
                    obj.validateView();
                    if (!obj.updateCompletePendingFlag) {
                        updateCompleteQueue.addObject(obj, obj.nestLevel);
                        obj.updateCompletePendingFlag = true;
                    }
                }
    
                // Once we start, don't stop.
                obj = invalidateViewQueue.removeSmallest();
            }
    
            if (invalidateViewQueue.isEmpty()) {
                invalidateViewFlag = false;
            }
        },
    
        /**
         *  @private
         */
        doPhasedInstantiation: function () {
            // trace(">>DoPhasedInstantation");
            // If phasing, do only one phase: validateProperties(),
            // validateSize(), or validateView().
            if (usePhasedInstantiation) {
                if (invalidatePropertiesFlag) {
                    this.validateProperties();
    
                    // The Preloader listens for this event.
//                    systemManager.document.dispatchEvent(new Event("validatePropertiesComplete"));
                } else if (invalidateSizeFlag) {
                    this.validateSize();
    
                    // The Preloader listens for this event.
//                    systemManager.document.dispatchEvent(new Event("validateSizeComplete"));
                } else if (invalidateViewFlag) {
                    this.validateView();
    
                    // The Preloader listens for this event.
//                    systemManager.document.dispatchEvent(new Event("validateViewComplete"));
                }
            } else {
                console.log( "not phased", "p", invalidatePropertiesFlag, "s", invalidateSizeFlag, "v", invalidateViewFlag );
                if (invalidatePropertiesFlag) {
                    this.validateProperties();
                }
                if (invalidateSizeFlag) {
                    this.validateSize();
                }
                if (invalidateViewFlag) {
                    this.validateView();
                }
            }
    
            // trace("invalidatePropertiesFlag " + invalidatePropertiesFlag);
            // trace("invalidateSizeFlag " + invalidateSizeFlag);
            // trace("invalidateViewFlag " + invalidateViewFlag);
    
            if (invalidatePropertiesFlag || invalidateSizeFlag || invalidateViewFlag) {
                this.attachListeners();
            } else {
                usePhasedInstantiation = false;
    
                listenersAttached = false;
    
                var obj = updateCompleteQueue.removeLargest();
                while (obj) {
                    if (!obj.clientInitialized && obj.processedDescriptors) {
                        obj.clientInitialized = true;
                    }
                    
                    var event = document.createEvent( "CustomEvent" );
                    event.initEvent( "validationComplete", true, true );
                    obj.dispatchEvent( event );
                    
//                    if (obj.hasEventListener(FlexEvent.UPDATE_COMPLETE)) {
//                        obj.dispatchEvent(new FlexEvent(FlexEvent.UPDATE_COMPLETE));
//                    }
                    obj.updateCompletePendingFlag = false;
                    obj = updateCompleteQueue.removeLargest();
                }
    
    
//                dispatchEvent(new FlexEvent(FlexEvent.UPDATE_COMPLETE));
            }
    
            // trace("<<DoPhasedInstantation");
        },
    
        /**
         *  When properties are changed, components generally do not apply those changes immediately.
         *  Instead the components usually call one of the LayoutManager's invalidate methods and
         *  apply the properties at a later time.  The actual property you set can be read back
         *  immediately, but if the property affects other properties in the component or its
         *  children or parents, those other properties may not be immediately updated.  To
         *  guarantee that the values are updated, you can call the <code>validateNow()</code> method.  
         *  It updates all properties in all components before returning.  
         *  Call this method only when necessary as it is a computationally intensive call.
         *  
         *  @langversion 3.0
         *  @playerversion Flash 9
         *  @playerversion AIR 1.1
         *  @productversion Flex 3
         */
        validateNow: function () {
            if (!usePhasedInstantiation) {
                var infiniteLoopGuard = 0;
                while (listenersAttached && infiniteLoopGuard++ < 100) {
                    doPhasedInstantiation();
                }
            }
        },
    
        /**
         *  When properties are changed, components generally do not apply those changes immediately.
         *  Instead the components usually call one of the LayoutManager's invalidate methods and
         *  apply the properties at a later time.  The actual property you set can be read back
         *  immediately, but if the property affects other properties in the component or its
         *  children or parents, those other properties may not be immediately updated.  
         *
         *  <p>To guarantee that the values are updated, 
         *  you can call the <code>validateClient()</code> method.  
         *  It updates all properties in all components whose nest level is greater than or equal
         *  to the target component before returning.  
         *  Call this method only when necessary as it is a computationally intensive call.</p>
         *
         *  @param target The component passed in is used to test which components
         *  should be validated.  All components contained by this component will have their
         *  <code>validateProperties()</code>, <code>commitProperties()</code>, 
         *  <code>validateSize()</code>, <code>measure()</code>, 
         *  <code>validateView()</code>, 
         *  and <code>updateView()</code> methods called.
         *
         *    @param skipView If <code>true</code>, 
         *  does not call the <code>validateView()</code> 
         *  and <code>updateView()</code> methods.
         *  
         *  @langversion 3.0
         *  @playerversion Flash 9
         *  @playerversion AIR 1.1
         *  @productversion Flex 3
         */
        validateClient: function (target, skip) {
    //        CONFIG::performanceInstrumentation
    //        {
    //            var perfUtil:PerfUtil = PerfUtil.getInstance();
    //            var token:int = perfUtil.markStart();
    //        }
    
            var skipView = skip !== null ? skip : false;
            var lastCurrentObject = currentObject;
            
            var obj;
            var i = 0;
            var done = false;
            var oldTargetLevel = targetLevel;
    
            // the theory here is that most things that get validated are deep in the tree
            // and so there won't be nested calls to validateClient.  However if there is,
            // we don't want to have a more sophisticated scheme of keeping track
            // of dirty flags at each level that is being validated, but we definitely
            // do not want to keep scanning the queues unless we're pretty sure that
            // something might be dirty so we just say that if something got dirty
            // during this call at a deeper nesting than the first call to validateClient
            // then we'll scan the queues.  So we only change targetLevel if we're the
            // outer call to validateClient and only that call restores it.
            if (targetLevel == 1000000)
            {
                targetLevel = target.nestLevel;
            }
            // trace("--- LayoutManager: validateClient ---> target = " + target);
    
            while (!done) {
                // assume we won't find anything
                done = true;
    
                // Keep traversing the invalidatePropertiesQueue until we've reached the end.
                // More elements may get added to the queue while we're in this loop, or a
                // a recursive call to this function may remove elements from the queue while
                // we're in this loop.
                obj = invalidatePropertiesQueue.removeSmallestChild(target);
                while (obj) {
                    // trace("LayoutManager calling validateProperties() on " + Object(obj) + " " + DisplayObject(obj).width + " " + DisplayObject(obj).height);
    
                    if (obj.nestLevel) {
                        currentObject = obj;
                        obj.validateProperties();
                        if (!obj.updateCompletePendingFlag) {
                            updateCompleteQueue.addObject(obj, obj.nestLevel);
                            obj.updateCompletePendingFlag = true;
                        }
                    }
                    
                    // Once we start, don't stop.
                    obj = invalidatePropertiesQueue.removeSmallestChild(target);
                }
    
                if (invalidatePropertiesQueue.isEmpty()) {
                    // trace("Properties Queue is empty");
    
                    invalidatePropertiesFlag = false;
                    invalidateClientPropertiesFlag = false;
                }
                
                // trace("--- LayoutManager: validateSize --->");
    
                obj = invalidateSizeQueue.removeLargestChild(target);
                while (obj) {
                    // trace("LayoutManager calling validateSize() on " + Object(obj));
    
                    if (obj.nestLevel) {
                        currentObject = obj;
                        obj.validateSize();
                        if (!obj.updateCompletePendingFlag) {
                            updateCompleteQueue.addObject(obj, obj.nestLevel);
                            obj.updateCompletePendingFlag = true;
                        }
                    }
    
                    // trace("LayoutManager validateSize: " + Object(obj) + " " + IFlexDisplayObject(obj).measuredWidth + " " + IFlexDisplayObject(obj).measuredHeight);
                    
                    if (invalidateClientPropertiesFlag) {
                        // did any properties get invalidated while validating size?
                        obj = invalidatePropertiesQueue.removeSmallestChild(target);
                        if (obj) {
                            // re-queue it. we'll pull it at the beginning of the loop
                            invalidatePropertiesQueue.addObject(obj, obj.nestLevel);
                            done = false;
                            break;
                        }
                    }
                    
                    obj = invalidateSizeQueue.removeLargestChild(target);
                }
    
                if (invalidateSizeQueue.isEmpty()) {
                    // trace("Measurement Queue is empty");
    
                    invalidateSizeFlag = false;
                    invalidateClientSizeFlag = false;
                }
    
                if (!skipView) {
                    // trace("--- LayoutManager: validateView --->");
    
                    obj = invalidateViewQueue.removeSmallestChild(target);
                    while (obj) {
                        // trace("LayoutManager calling validateView on " + Object(obj) + " " + DisplayObject(obj).width + " " + DisplayObject(obj).height);
    
                        if (obj.nestLevel) {
                            currentObject = obj;
                            obj.validateView();
                            if (!obj.updateCompletePendingFlag) {
                                updateCompleteQueue.addObject(obj, obj.nestLevel);
                                obj.updateCompletePendingFlag = true;
                            }
                        }
                        // trace("LayoutManager return from validateView on " + Object(obj) + " " + DisplayObject(obj).width + " " + DisplayObject(obj).height);
    
                        if (invalidateClientPropertiesFlag) {
                            // did any properties get invalidated while validating size?
                            obj = invalidatePropertiesQueue.removeSmallestChild(target);
                            if (obj) {
                                // re-queue it. we'll pull it at the beginning of the loop
                                invalidatePropertiesQueue.addObject(obj, obj.nestLevel);
                                done = false;
                                break;
                            }
                        }
    
                        if (invalidateClientSizeFlag) {
                            obj = invalidateSizeQueue.removeLargestChild(target);
                            if (obj) {
                                // re-queue it. we'll pull it at the beginning of the loop
                                invalidateSizeQueue.addObject(obj, obj.nestLevel);
                                done = false;
                                break;
                            }
                        }
    
                        // Once we start, don't stop.
                        obj = invalidateViewQueue.removeSmallestChild(target);
                    }
    
    
                    if (invalidateViewQueue.isEmpty()) {
                        // trace("Layout Queue is empty");
    
                        invalidateViewFlag = false;
                    }
                }
            }
    
            if (oldTargetLevel == 1000000) {
                targetLevel = 1000000;
                if (!skipView) {
                    obj = updateCompleteQueue.removeLargestChild(target);
                    while (obj) {
                        if (!obj.clientInitialized) {
                            obj.clientInitialized = true;
                        }
                        if (obj.hasEventListener(FlexEvent.UPDATE_COMPLETE)) {
                            obj.dispatchEvent(new FlexEvent(FlexEvent.UPDATE_COMPLETE));
                        }
                        obj.updateCompletePendingFlag = false;
                        obj = updateCompleteQueue.removeLargestChild(target);
                    }
                }
            }
    
            currentObject = lastCurrentObject;
            
    //        CONFIG::performanceInstrumentation
    //        {
    //            perfUtil.markEnd(" validateClient()", token, 2 /*tolerance*/, target);
    //        }
            
            // trace("<--- LayoutManager: validateClient --- target = " + target);
        },
    
        /**
         *  Returns <code>true</code> if there are components that need validating;
         *  <code>false</code> if all components have been validated.
             *
             *  @return Returns <code>true</code> if there are components that need validating;
         *  <code>false</code> if all components have been validated.
         *  
         *  @langversion 3.0
         *  @playerversion Flash 9
         *  @playerversion AIR 1.1
         *  @productversion Flex 3
         */
        isInvalid: function () {
            return invalidatePropertiesFlag || invalidateSizeFlag || invalidateViewFlag;
        },
    
        /**
         *  @private
         *  callLater() is called immediately after an object is created.
         *  We really want to wait one more frame before starting in.
         */
        waitAFrame: function () {
            // trace(">>LayoutManager:WaitAFrame");
            
//            systemManager.removeEventListener(Event.ENTER_FRAME, waitAFrame);
//            systemManager.addEventListener(Event.ENTER_FRAME, doPhasedInstantiationCallback);
            var inst = this;
            window.requestAnimationFrame( function() {
                inst.doPhasedInstantiationCallback()
            } );
//            waitedAFrame = true;
    
            // trace("<<LayoutManager:WaitAFrame");
        },
    
        
        attachListeners: function () {
            var inst = this;
            if (!waitedAFrame) {
                window.requestAnimationFrame( function() { 
                    inst.waitAFrame();
                } );
            } else {
                 window.requestAnimationFrame( function() { 
                     inst.doPhasedInstantiationCallback()
                 } );
//                systemManager.addEventListener(Event.ENTER_FRAME, doPhasedInstantiationCallback);
//                if (!usePhasedInstantiation) {
//                    if (systemManager && (systemManager.stage || usingBridge(systemManager))) {
//                        systemManager.addEventListener(Event.RENDER, doPhasedInstantiationCallback);
//                        if (systemManager.stage) {
//                            systemManager.stage.invalidate();
//                        }
//                    }
//                }
            }
    
            listenersAttached = true;
        },
    
        doPhasedInstantiationCallback: function (){
            // if our background processing is suspended, then we shouldn't do any 
            // validation
            if (UIComponentGlobals.callLaterSuspendCount > 0) {
                return;
            }
            
//            systemManager.removeEventListener(Event.ENTER_FRAME, doPhasedInstantiationCallback);
//            systemManager.removeEventListener(Event.RENDER, doPhasedInstantiationCallback);		
    
//            if (!UIComponentGlobals.catchCallLaterExceptions) {
//                doPhasedInstantiation();
//            } else {
                try {
                    this.doPhasedInstantiation();
                } catch(e) {
                    // Dispatch a callLaterError dynamic event for Design View. 
//                    var callLaterErrorEvent:DynamicEvent = new DynamicEvent("callLaterError");
//                    callLaterErrorEvent.error = e;
//                    callLaterErrorEvent.source = this; 
//                    callLaterErrorEvent.object = currentObject;
//                    systemManager.dispatchEvent(callLaterErrorEvent);
                }
//            }
            currentObject = null;
        },
    
        
    
        /**
         *  @private
         */
        usingBridge: function (sm) {
            if (_usingBridge == 0) {
                return false;
            }
            if (_usingBridge == 1) {
                return true;
            }
    
            if (!sm) {
                return false;
            }
    
            // no types so no dependencies
            var mp = sm.getImplementation("mx.managers::IMarshalSystemManager");
            if (!mp) {
                _usingBridge = 0;
                return false;
            }
            if (mp.useSWFBridge()) {
                _usingBridge = 1;
                return true;
            }
            _usingBridge = 0;
            return false;
        }
    }
}



    //--------------------------------------------------------------------------
    //
    //  Class methods
    //
    //--------------------------------------------------------------------------

    /**
     *  Returns the sole instance of this singleton class,
     *  creating it if it does not already exist.
         *
         *  @return Returns the sole instance of this singleton class,
     *  creating it if it does not already exist.
         *  
         *  @langversion 3.0
         *  @playerversion Flash 9
         *  @playerversion AIR 1.1
         *  @productversion Flex 3
         */
    InvalidationManager.getInstance = function() {
        if (!InvalidationManager.instance) {
            InvalidationManager.instance = new InvalidationManager();
        }
        return InvalidationManager.instance;
    }
    wx = window.wx || {};
    wx.core = wx.core || {};
    wx.core.InvalidationManager = InvalidationManager;
})();