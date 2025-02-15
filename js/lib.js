//
// document something
//

class FragmentConstructor {
  static itemCardConstructor(itemId,itemName,isInCart,itemPrice,isRangeOfPrices) {
    let fragment = new DocumentFragment();
    let inputCheckbox = document.createElement("input");
      inputCheckbox.setAttribute("type","checkbox");
      inputCheckbox.setAttribute("id",itemId);
      inputCheckbox.setAttribute("value","value");
      inputCheckbox.setAttribute("onchange","itemSelectHandle(event)");
      if (isInCart) {
        inputCheckbox.setAttribute("checked","checked");
      }

    let labelForCheckbox = document.createElement("label");
      labelForCheckbox.setAttribute("for",itemId);
    
    let itemDetailsButton = document.createElement("button")
      itemDetailsButton.setAttribute("onclick",`handlerItemDiscountsButton(${itemId})`)
      itemDetailsButton.append("item_info")
    
    

    let divPrices = document.createElement("div");
      divPrices.setAttribute("class","rightside");
      // TODO:
      // The handling of price logic and display within this component
      // feels questionable to me.
      //
      if (isRangeOfPrices) {
        let minimumItemPrice = Math.min(...itemPrice); // TODO PERF: Maybe switch from spreading to Array.reduce
        let maximumItemPrice = Math.max(...itemPrice);

        if (minimumItemPrice === maximumItemPrice) { // TODO PERF: Unnecessary computations for an early exit. Could instead check if there is only one unique price. and put the min/max price calculations into the complex scope.
          // If an item has only one price show it
          divPrices.textContent = maximumItemPrice/100;
        } else {
          // If the item has multiple prices accross stores show them as a range
          //construct the lowest price
          let spanMinPrice = document.createElement("span");
            spanMinPrice.setAttribute("style","color:lightgreen;"); // TODO: Separate Styling into css classes
            spanMinPrice.textContent = minimumItemPrice/100;

          //construct the lowest price
          let spanMaxPrice = document.createElement("span");
            spanMaxPrice.setAttribute("style","color:lightcoral;");
            spanMaxPrice.textContent = maximumItemPrice/100;

          // make the numbers separated by two dots.
          divPrices.textContent = "..";
          divPrices.prepend(spanMinPrice);
          divPrices.append(spanMaxPrice);
        }

      } else if (!isRangeOfPrices) {
        divPrices.textContent = itemPrice/100;
      }

    let divItemcard = document.createElement("article");
      divItemcard.setAttribute("class","itemcard");
      divItemcard.append(itemName);
      divItemcard.append(itemDetailsButton);

      divItemcard.prepend(labelForCheckbox);
      divItemcard.prepend(inputCheckbox);
      divItemcard.append(divPrices);

    fragment.append(divItemcard);
    return fragment
  }
  
  static fragmentItemEntry(itemId,itemIdx,boolIsChecked,stringItemName,stringItemUnit,numItemMultiplier,numPriceLow,numPriceHigh,hasButtons,isVisibilityControl,isDoubleDeleted,isInGroup,isOnePrice) {
    let fragment = document.createElement("a");
      fragment.setAttribute("class","row padding");
      fragment.setAttribute("data-item-id",itemId);
      fragment.setAttribute("data-item-idx",itemIdx);
    //  Checkbox
    let iconChkOff = document.createElement("i");
      iconChkOff.append(isVisibilityControl ? "visibility_off" : "shopping_cart");

    let iconChkOn = document.createElement("i");
      if(!isVisibilityControl){iconChkOn.setAttribute("class","fill")}
      iconChkOn.append(isVisibilityControl ? "visibility" : "shopping_cart");

    let elemChkStateContainer = document.createElement("span");
      elemChkStateContainer.append(iconChkOff);
      elemChkStateContainer.append(iconChkOn);

    let elemInput = document.createElement("input");
      elemInput.setAttribute("type","checkbox");
      if (boolIsChecked) {
        elemInput.setAttribute("checked","");
      }

    let elemCheckbox = document.createElement("label");
      elemCheckbox.setAttribute("class","checkbox icon");
      elemCheckbox.setAttribute("data-action-type",(isVisibilityControl ? "item_visibility" : "item_selection"))
      elemCheckbox.append(elemInput);
      elemCheckbox.append(elemChkStateContainer);

    fragment.append(elemCheckbox);

    // Name and Unit
    let iconInfo = document.createElement("i");
      iconInfo.setAttribute("class","tiny");
      iconInfo.append("info");

    let elemItemUnits = document.createElement("div");
      elemItemUnits.append(stringItemUnit);

    let elemItemName = document.createElement("h6");
      elemItemName.setAttribute("class","small");
      elemItemName.setAttribute("style","display: block;");
      elemItemName.append(stringItemName);
      elemItemName.append(iconInfo);

    let elemItemNameWithUnit = document.createElement("div");
      elemItemNameWithUnit.setAttribute("class","max");
      elemItemNameWithUnit.setAttribute("data-action-type","item_info")
      elemItemNameWithUnit.append(elemItemName);
      elemItemNameWithUnit.append(elemItemUnits);

    fragment.append(elemItemNameWithUnit);

    if (hasButtons) {
      // Delete Button
      let iconDelete = document.createElement("i");
        iconDelete.setAttribute("class","small");
        iconDelete.append(isDoubleDeleted ? "delete_forever" : "delete");

      let elemBtnDelete = document.createElement("button");
        elemBtnDelete.setAttribute("class","small transparent square" + (isDoubleDeleted ? " red-text" : ""));
        elemBtnDelete.setAttribute("style","margin-left: -1rem;");
        elemBtnDelete.setAttribute("data-action-type","item_delete")
        elemBtnDelete.append(iconDelete);

      // group button
      let iconGroup = document.createElement("i");
        iconGroup.setAttribute("class","small");
        iconGroup.append(isInGroup ? "library_add_check" : "library_add");

      let elemBtnGroup = document.createElement("button");
        elemBtnGroup.setAttribute("class","small transparent square");
        elemBtnGroup.setAttribute("style","margin-left: -1rem;margin-right: -1rem;");
        elemBtnGroup.setAttribute("data-action-type","item_group");
        elemBtnGroup.append(iconGroup);

      // nav for buttons to be horizontal
      let elemButtonNav = document.createElement("nav");
        elemButtonNav.setAttribute("style","margin-top: 0px;");
        elemButtonNav.append(elemBtnDelete);
        elemButtonNav.append(elemBtnGroup);

      // multiplier input
      let elemMulInput = document.createElement("input");
        elemMulInput.setAttribute("type","number");
        elemMulInput.setAttribute("value",numItemMultiplier);
        elemMulInput.setAttribute("style","width: 3em;appearance: auto;");
        elemMulInput.setAttribute("data-action-type","item_multiplier")

      // div for vertical
      let divVertical = document.createElement("div");
        divVertical.setAttribute("class","vertical");
        divVertical.append(elemMulInput);
        divVertical.append(elemButtonNav);

      fragment.append(divVertical);
    }

    // price chip/s
    if (isOnePrice) {
      let elemPrice = document.createElement("label");
        elemPrice.setAttribute("class","chip primary round");
        elemPrice.append(numPriceLow);

      fragment.append(elemPrice);
    } else {
      let elemPriceLow = document.createElement("label");
        elemPriceLow.setAttribute("class","chip primary no-border");
        elemPriceLow.setAttribute("style","width: 100%;border-radius: 0;border-start-start-radius: 1rem;border-start-end-radius: 1rem;");
        elemPriceLow.append(numPriceLow);

      let elemPriceHigh = document.createElement("label");
        elemPriceHigh.setAttribute("class","chip tertiary no-border");
        elemPriceHigh.setAttribute("style","width: 100%;border-radius: 0;border-end-end-radius: 1rem;border-end-start-radius: 1rem");
        elemPriceHigh.append(numPriceHigh);

      let elemPriceContainer = document.createElement("nav");
        elemPriceContainer.setAttribute("class","vertical no-space");
        elemPriceContainer.append(elemPriceLow);
        elemPriceContainer.append(elemPriceHigh);

      fragment.append(elemPriceContainer);
    }

    return fragment
  }
  
  static fragmentItemGroup(numGroupIdx,fragmentContent,isDoubleDeleted,isBeingEdited) {
    let fragment = document.createElement("article");
      if (isBeingEdited) {
        fragment.setAttribute("class","tertiary-container");
      }

    let aHeader = document.createElement("a")
      aHeader.setAttribute("class","row");
      aHeader.setAttribute("data-group-id",numGroupIdx);

    // group name
    let elemGroupName = document.createElement("h6");
      elemGroupName.setAttribute("class","small");
      elemGroupName.append(`Group #${numGroupIdx}`);

    aHeader.append(elemGroupName);

    // Delete Button
    let iconDelete = document.createElement("i");
      iconDelete.append(isDoubleDeleted ? "delete_forever" : "delete");

    let elemBtnDelete = document.createElement("button");
      elemBtnDelete.setAttribute("class","transparent square" + (isDoubleDeleted ? " red-text" : ""));
      elemBtnDelete.setAttribute("style","margin-left: -1rem;");
      elemBtnDelete.setAttribute("data-action-type","group_delete");
      elemBtnDelete.append(iconDelete);

    aHeader.append(elemBtnDelete);

    // edit button
    let iconGroup = document.createElement("i");
      iconGroup.append("edit");

    let elemBtnGroup = document.createElement("button");
      elemBtnGroup.setAttribute("class","transparent square" + (isBeingEdited ? " orange-text" : ""));
      elemBtnGroup.setAttribute("style","margin-left: -1rem;margin-right: -1rem;");
      elemBtnGroup.setAttribute("data-action-type","group_edit");
      elemBtnGroup.append(iconGroup);

    aHeader.append(elemBtnGroup);

    fragment.append(aHeader);
    fragment.append(fragmentContent);
    return fragment
  }
  
  static shoppingCartMemberConstructor(itemIdx,selectedItemMultiplier,globalItemList,isInGroup,groupId) {
    let itemId = globalItemList.itemIds[itemIdx];
    let boolIsChecked = true;
    let stringItemName = globalItemList.itemNames[itemIdx];
    
    let stringItemUnit = "TODO: Item Units"
    
    let numItemMultiplier = selectedItemMultiplier.has(String(itemIdx)) ? selectedItemMultiplier.get(String(itemIdx)) : 1;
    
    let itemPrices = globalItemList.itemPricingData[itemIdx].pricesAtStores
    let minItemPrice = Number.MAX_SAFE_INTEGER
    let maxItemPrice = Number.MIN_SAFE_INTEGER 
    
    for (let i=0; i<itemPrices.length; i++) {
      let price = itemPrices[i];
      if (price < minItemPrice) { minItemPrice = price }
      if (price > maxItemPrice) { maxItemPrice = price }
    }
    let isOnePrice = (minItemPrice === maxItemPrice)
    let numPriceLow = minItemPrice/100
    let numPriceHigh = maxItemPrice/100
    
    let hasButtons = true;
    let isVisibilityControl = true;
    let isDoubleDeleted = false;
    
    // fragmentItemEntry(itemId,itemIdx,boolIsChecked,stringItemName,stringItemUnit,numItemMultiplier,numPriceLow,numPriceHigh,hasButtons,isVisibilityControl,isDoubleDeleted,isInGroup,isOnePrice);
    let fragmentItemCard = FragmentConstructor.fragmentItemEntry(itemId,itemIdx,boolIsChecked,stringItemName,stringItemUnit,numItemMultiplier,numPriceLow,numPriceHigh,hasButtons,isVisibilityControl,isDoubleDeleted,isInGroup,isOnePrice);

    fragmentItemCard.setAttribute("data-group-id",groupId);
    return fragmentItemCard
  }
  
  static shoppingCartConstructor(cartItems,selectedItemMultiplier,globalItemList,groupBeingEdited) {
    let fragment = new DocumentFragment();
    let divNode = document.createElement("div");

    let groupIndex = -1;
    cartItems.forEach((itemIdx,index) => {
      if (Array.isArray(itemIdx)) {
        groupIndex++;
        // if this is a group
        let fragmentContent = new DocumentFragment();
        
        itemIdx.forEach(subItemIdx => {
          let subProw = FragmentConstructor.shoppingCartMemberConstructor(subItemIdx,selectedItemMultiplier,globalItemList,true,groupIndex);
          fragmentContent.append(subProw);
        });
        
        let numGroupIdx = groupIndex;
        let isDoubleDeleted = false;
        let isBeingEdited = (groupBeingEdited == groupIndex);
        // fragmentItemGroup(numGroupIdx,fragmentContent,isDoubleDeleted,isBeingEdited)
        var pRow = FragmentConstructor.fragmentItemGroup(numGroupIdx,fragmentContent,isDoubleDeleted,isBeingEdited);
      } else {
        var pRow = FragmentConstructor.shoppingCartMemberConstructor(itemIdx,selectedItemMultiplier,globalItemList,false,-1);
      }

      divNode.append(pRow);
    });
    
    // New Group Button
    /*
    <button class="responsive small-elevate extra surface-container margin">
      <i>home</i>
      <span>Add group</span>
    </button>
    */
    let iconHome = document.createElement("i");
      iconHome.append("home");
    
    let spanText = document.createElement("span");
      spanText.append("Add Group")
    
    let newGroupButton = document.createElement("button");
      newGroupButton.setAttribute("class","responsive small-elevate extra surface-container margin");
      newGroupButton.setAttribute("onclick","handlerNewGroupButton(event)");
      newGroupButton.setAttribute("data-action-type","group_create");
      newGroupButton.append(iconHome);
      newGroupButton.append(spanText);
    
    divNode.append(newGroupButton);
    
    fragment.append(divNode);
    return fragment
  }
}

class Utils {
  static filterItemsByStoreId(itemIdArray,storeId,globalItemsData) {
    console.log(`filtering ${itemIdArray.length} items for being in store ${storeId}`);
    let searchedItemIdArray = itemIdArray.filter((element) => {
      return globalItemsData.itemPricingData[element].stores.some(storeid_from_list => storeid_from_list === Number(storeId))
    });
    return searchedItemIdArray
  }
  
  static filterItemsBySearchQuery(itemIdArray,searchQuery,globalItemsData) {
    console.log(`filtering ${itemIdArray.length} items for names/barcodes including ${searchQuery}`);
    //
    // NOTE: This function implements memoization. Because in virtual lists it gets called with the same parameters
    // every time we scroll, And thus we end up spending 70% of our interaction response time doing this repeat work.
    //
    // I understand that handling this here instead of the culprit virtual lists is harmful abstraction. But I am lazy,
    // And really dont want to deal with history dependent state up there.
    // 
    // This also makes an ASSUMPTION that globalItemsData is immutable. Which will not be the case once seamless background
    // data updates is a thing.
    //
    
    // Check if memoized. invalidate as soon as possible.
    var isQueryMemoized = true; // start by assuming that what were querying is what we memoized
    if (window.SEARCH_MEMO.itemIdArray.length === itemIdArray.length) {
      if (window.SEARCH_MEMO.searchQuery === searchQuery) {
        // were doing a deep comparison between the arrays to really make sure that the cache is valid
        for (var i=0; i<itemIdArray.length; i++) {
          if (itemIdArray[i] !== window.SEARCH_MEMO.itemIdArray[i]) {
            console.debug("Search Memoization Invalidated due to array content mismatch");
            isQueryMemoized = false;
            break // break early out of the for loop if the arrays are not the same
          }
        } 
        // break jumps here
      } else { isQueryMemoized = false; console.debug("Search Memoization Invalidated due to search query mismatch"); }
    } else { isQueryMemoized = false; console.debug("Search Memoization Invalidated due to array length mismatch"); }
    
    if (isQueryMemoized) {
      return window.SEARCH_MEMO.result
    } else {
      // run the query
      if (searchQuery.trim().length === 0) { // If the search query is empty return unmodified list
        var searchedItemIdArray = itemIdArray // browser debugging equivalent Array.from(Array(globalItemList.itemNames.length).keys());
      } else if (!isNaN(searchQuery.trim())) {
        var searchedItemIdArray = itemIdArray.filter((element) => {
          return String(globalItemsData.itemIds[element]).includes(searchQuery);
        }); 
      } else {
        // browser debugging equivalent Array.from(Array(window.item2Store.itemNames.length).keys()).filter((element) => {return window.item2Store.itemNames[element].includes("290")}) 
        var searchedItemIdArray = itemIdArray.filter((element) => {
          return globalItemsData.itemNames[element].includes(searchQuery)
        }); 
      }
      // memoize the query
      window.SEARCH_MEMO = {
        itemIdArray: itemIdArray,
        searchQuery: searchQuery,
        result: searchedItemIdArray
      } 
      console.log(window.SEARCH_MEMO)
      // return query result
      return searchedItemIdArray
    }

  }
}