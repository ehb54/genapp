
   private slots:
      void                          module_load___menu:id_____menu:modules:id__();
      void                          module_submit___menu:id_____menu:modules:id__();
      void                          module_reset___menu:id_____menu:modules:id__();
      void                          error___menu:id_____menu:modules:id__( QProcess::ProcessError );
      void                          readyReadStandardOutput___menu:id_____menu:modules:id__();
      void                          readyReadStandardError___menu:id_____menu:modules:id__();
      void                          finished___menu:id_____menu:modules:id__( int, QProcess::ExitStatus );

   private:
      QProcess *                    process___menu:id_____menu:modules:id__;
