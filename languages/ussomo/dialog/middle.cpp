   pb_help = new QPushButton(tr("Help"), this);
   pb_help->setFont(QFont( USglobal->config_list.fontFamily, USglobal->config_list.fontSize + 1));
   pb_help->setPalette( QPalette(USglobal->global_colors.cg_pushb, USglobal->global_colors.cg_pushb_disabled, USglobal->global_colors.cg_pushb_active));
   connect(pb_help, SIGNAL(clicked()), SLOT(help()));

   pb_cancel = new QPushButton(tr("Close"), this);
   pb_cancel->setFont(QFont( USglobal->config_list.fontFamily, USglobal->config_list.fontSize + 1));
   pb_cancel->setPalette( QPalette(USglobal->global_colors.cg_pushb, USglobal->global_colors.cg_pushb_disabled, USglobal->global_colors.cg_pushb_active));
   connect(pb_cancel, SIGNAL(clicked()), SLOT(cancel()));

   {
      QHBoxLayout * hbl = new QHBoxLayout();
      hbl->addWidget( pb_help );
      hbl->addWidget( pb_cancel );
      for ( int i = 0; i < (int) bottom_row_buttons.size(); ++i ) {
         hbl->addWidget( bottom_row_buttons[ i ] );
      }

      background->addMultiCellLayout( hbl, row, row, 0, colmax - 1 );
   }

   for ( map < QWidget *, vector < QWidget * > >::iterator it = repeats.begin();
         it != repeats.end();
         it++ ) {
      showhide( it->second, ((QCheckBox* )it->first)->isChecked() );
   }
}

