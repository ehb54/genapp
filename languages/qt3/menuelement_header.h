void __application__::__menu:id___pressed()
{
   hide_widgets( menu_widgets );
   menu_button->setPixmap( id_to_icon[ "__menu:id__" ] );
   delete_widgets_layouts( panel1_widgets, panel1_layouts );
   delete_widgets_layouts( panel1_sub_widgets, panel1_sub_layouts );
   panel1_widget_map.clear();
   panel1_inputs.clear();
   panel1_outputs.clear();
   panel1_map_input.clear();

   QHBoxLayout *hbl = new QHBoxLayout( 0 );

