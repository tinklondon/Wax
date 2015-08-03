//if( !polex ) polex = {};
//if( !polex.collections ) polex.collections = {};

var PriorityQueue = function () {
    
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
     */
    var priorityBins = [];

    /**
     *  @private
     *  The smallest occupied index in arrayOfDictionaries.
     */
    var minPriority = 0;
    
    /**
     *  @private
     *  The largest occupied index in arrayOfDictionaries.
     */
    var maxPriority = -1;
    

    //--------------------------------------------------------------------------
    //
    //  Public
    //
    //--------------------------------------------------------------------------
    
    return {
        
        getHighestPriority: function () {
            return maxPriority;
        },
        
        //--------------------------------------------------------------------------
        //  Methods
        //--------------------------------------------------------------------------
        
        /**
         *  @private
         */
        addObject: function (obj, priority) {
            // Update our min and max priorities.
            if (maxPriority < minPriority) {
                minPriority = maxPriority = priority;
            } else {
                if (priority < minPriority) {
                    minPriority = priority;
                }
                if (priority > maxPriority) {
                    maxPriority = priority;
                }
            }
                
            var bin = priorityBins[priority];
            
            if (!bin) {
                // If no hash exists for the specified priority, create one.
                bin = [];
                priorityBins[priority] = bin;
                bin.push(obj);
            } else {
                // If we don't already hold the obj in the specified hash, add it
                // and update our item count.
                if (bin.indexOf(obj) === -1) {
                    bin.push(obj);
                }
            }
            
        },
    
        /**
         *  @private
         */
        removeLargest: function () {
            var obj = null;
    
            if (minPriority <= maxPriority) {
                var bin = priorityBins[maxPriority];
                while (!bin || bin.length === 0) {
                    maxPriority -= 1;
                    if (maxPriority < minPriority) {
                        return null;
                    }
                    bin = priorityBins[maxPriority];
                }
            
                // Remove the item with largest priority from our priority queue.
                // Must use a for loop here since we're removing a specific item
                // from a 'Dictionary' (no means of directly indexing).
                if( bin.length ) {
                    obj = bin.splice( 0, 1 )[ 0 ];   
                }
    
                // Update maxPriority if applicable.
                while (!bin || bin.length === 0) {
                    maxPriority -= 1;
                    if (maxPriority < minPriority) {
                        break;
                    }
                    bin = priorityBins[maxPriority];
                }
                
            }
            
            return obj;
        },
    
        /**
         *  @private
         */
        removeSmallest: function () {
            var obj = null;
    
            if (minPriority <= maxPriority) {
                var bin = priorityBins[minPriority];
                while (!bin || bin.length === 0) {
                    minPriority += 1;
                    if (minPriority > maxPriority) {
                        return null;
                    }
                    bin = priorityBins[minPriority];
                }
                
                // Remove the item with smallest priority from our priority queue.
                // Must use a for loop here since we're removing a specific item
                // from a 'Dictionary' (no means of directly indexing).
                if( bin.length ) {
                    obj = bin.splice( 0, 1 )[ 0 ];   
                }
    
                // Update minPriority if applicable.
                while (!bin || bin.length === 0) {
                    minPriority += 1;
                    if (minPriority > maxPriority) {
                        break;
                    }
                    bin = priorityBins[minPriority];
                }
            }
    
            return obj;
        },
        
        /**
         *  @private
         */
        isEmpty: function () {
            return minPriority > maxPriority;
        }
    };
};

PriorityQueue.bingo = "tink";